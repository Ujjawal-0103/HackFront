import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Neo4jService } from "./neo4j.service";

export interface GraphSyncResult {
  repositoryId: string;
  commitsMerged: number;
  filesMerged: number;
  pullRequestsMerged: number;
  issuesMerged: number;
  relationshipsMerged: number;
  durationMs: number;
}

export interface GraphNeighbourNode {
  sourceId: string;
  sourceType: string;
  referenceKey: string;
  relationship: string;
  depth: number;
  seedSourceId: string;
}

@Injectable()
export class GraphProjectionService {
  private readonly logger = new Logger(GraphProjectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly neo4j: Neo4jService,
  ) {}

  /**
   * Initializes graph schema constraints and indexes idempotently.
   */
  async initializeSchema(): Promise<void> {
    if (!this.neo4j.isAvailable()) {
      this.logger.debug("Neo4j offline; skipping graph schema initialization.");
      return;
    }

    const constraints = [
      "CREATE CONSTRAINT repository_id_uniq IF NOT EXISTS FOR (r:Repository) REQUIRE r.id IS UNIQUE",
      "CREATE CONSTRAINT commit_id_uniq IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE",
      "CREATE CONSTRAINT pr_id_uniq IF NOT EXISTS FOR (pr:PullRequest) REQUIRE pr.id IS UNIQUE",
      "CREATE CONSTRAINT issue_id_uniq IF NOT EXISTS FOR (i:Issue) REQUIRE i.id IS UNIQUE",
      "CREATE CONSTRAINT doc_id_uniq IF NOT EXISTS FOR (d:Documentation) REQUIRE d.id IS UNIQUE",
    ];

    for (const cypher of constraints) {
      try {
        await this.neo4j.runQuery(cypher);
      } catch (err) {
        this.logger.warn(
          `Failed to initialize graph constraint: ${String(err)}`,
        );
      }
    }
  }

  /**
   * Projects PostgreSQL repository records into the Neo4j graph model idempotently.
   */
  async syncRepository(repositoryId: string): Promise<GraphSyncResult> {
    const startTime = Date.now();

    if (!this.neo4j.isAvailable()) {
      return {
        repositoryId,
        commitsMerged: 0,
        filesMerged: 0,
        pullRequestsMerged: 0,
        issuesMerged: 0,
        relationshipsMerged: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const repo = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        commits: { include: { diffs: true } },
        pullRequests: true,
        issues: true,
      },
    });

    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found in database.`);
    }

    let commitsMerged = 0;
    let filesMerged = 0;
    let pullRequestsMerged = 0;
    let issuesMerged = 0;
    let relationshipsMerged = 0;

    await this.initializeSchema();

    // 1. Merge Repository Node
    await this.neo4j.runQuery(
      `MERGE (r:Repository { id: $repoId })
       ON CREATE SET r.fullName = $fullName, r.createdAt = timestamp()
       ON MATCH SET r.fullName = $fullName`,
      { repoId: repo.id, fullName: repo.fullName },
    );

    // 2. Merge Commits, Files, and MODIFIES_FILE edges
    for (const commit of repo.commits) {
      await this.neo4j.runQuery(
        `MATCH (r:Repository { id: $repoId })
         MERGE (c:Commit { id: $commitId })
         ON CREATE SET c.sha = $sha, c.repositoryId = $repoId, c.author = $author, c.committedAt = $committedAt
         ON MATCH SET c.author = $author, c.committedAt = $committedAt
         MERGE (r)-[:HAS_COMMIT]->(c)`,
        {
          repoId: repo.id,
          commitId: commit.id,
          sha: commit.sha,
          author: commit.authorName,
          committedAt: commit.committedAt.toISOString(),
        },
      );
      commitsMerged++;
      relationshipsMerged++;

      for (const diff of commit.diffs) {
        await this.neo4j.runQuery(
          `MATCH (c:Commit { id: $commitId })
           MERGE (f:File { repositoryId: $repoId, path: $filePath })
           ON CREATE SET f.createdAt = timestamp()
           MERGE (c)-[m:MODIFIES_FILE]->(f)
           ON CREATE SET m.status = $status, m.additions = $additions, m.deletions = $deletions
           ON MATCH SET m.status = $status, m.additions = $additions, m.deletions = $deletions`,
          {
            repoId: repo.id,
            commitId: commit.id,
            filePath: diff.filePath,
            status: diff.status,
            additions: diff.additions,
            deletions: diff.deletions,
          },
        );
        filesMerged++;
        relationshipsMerged++;
      }
    }

    // 3. Merge Pull Requests and HAS_PULL_REQUEST
    for (const pr of repo.pullRequests) {
      await this.neo4j.runQuery(
        `MATCH (r:Repository { id: $repoId })
         MERGE (pr:PullRequest { id: $prId })
         ON CREATE SET pr.number = $number, pr.repositoryId = $repoId, pr.title = $title, pr.state = $state
         ON MATCH SET pr.title = $title, pr.state = $state
         MERGE (r)-[:HAS_PULL_REQUEST]->(pr)`,
        {
          repoId: repo.id,
          prId: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
        },
      );
      pullRequestsMerged++;
      relationshipsMerged++;

      // Detect Issue references from PR title/body (e.g. "fixes #12", "closes #42", "#15")
      const text = `${pr.title} ${pr.body || ""}`;
      const issueMatches = Array.from(text.matchAll(/#(\d+)/g));
      for (const match of issueMatches) {
        const referencedNum = parseInt(match[1], 10);
        if (referencedNum !== pr.number) {
          const referencedIssue = repo.issues.find(
            (i) => i.number === referencedNum,
          );
          if (referencedIssue) {
            await this.neo4j.runQuery(
              `MATCH (pr:PullRequest { id: $prId }), (i:Issue { id: $issueId })
               MERGE (pr)-[:REFERENCES_ISSUE]->(i)`,
              { prId: pr.id, issueId: referencedIssue.id },
            );
            relationshipsMerged++;
          }
        }
      }
    }

    // 4. Merge Issues and HAS_ISSUE
    for (const issue of repo.issues) {
      await this.neo4j.runQuery(
        `MATCH (r:Repository { id: $repoId })
         MERGE (i:Issue { id: $issueId })
         ON CREATE SET i.number = $number, i.repositoryId = $repoId, i.title = $title, i.state = $state
         ON MATCH SET i.title = $title, i.state = $state
         MERGE (r)-[:HAS_ISSUE]->(i)`,
        {
          repoId: repo.id,
          issueId: issue.id,
          number: issue.number,
          title: issue.title,
          state: issue.state,
        },
      );
      issuesMerged++;
      relationshipsMerged++;
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `Graph projection completed for repository ${repo.fullName}: ${commitsMerged} commits, ${filesMerged} files, ${pullRequestsMerged} PRs, ${issuesMerged} issues in ${durationMs}ms`,
    );

    return {
      repositoryId,
      commitsMerged,
      filesMerged,
      pullRequestsMerged,
      issuesMerged,
      relationshipsMerged,
      durationMs,
    };
  }

  /**
   * Finds connected neighbouring nodes within bounded depth (1..2) restricted to repository.
   */
  async findConnectedNeighbours(
    repositoryId: string,
    seedSourceExternalIds: string[],
    maxDepth = 2,
    limit = 10,
  ): Promise<GraphNeighbourNode[]> {
    if (!this.neo4j.isAvailable() || seedSourceExternalIds.length === 0) {
      return [];
    }

    const depth = Math.min(Math.max(1, maxDepth), 2);
    const boundedLimit = Math.min(Math.max(1, limit), 20);

    const cypher = `
      MATCH (seed)
      WHERE (seed:Commit AND seed.sha IN $seedIds)
         OR (seed:PullRequest AND toString(seed.number) IN $seedIds)
         OR (seed:Issue AND toString(seed.number) IN $seedIds)
      MATCH path = (seed)-[r*1..${depth}]-(target)
      WHERE (target:Commit OR target:PullRequest OR target:Issue)
        AND target <> seed
        AND target.repositoryId = $repositoryId
      WITH seed, target, relationships(path)[0] AS firstRel, length(path) AS pathLength
      RETURN DISTINCT
        target.id AS targetId,
        labels(target)[0] AS targetType,
        CASE
          WHEN target:Commit THEN target.sha
          WHEN target:PullRequest THEN '#' + toString(target.number)
          WHEN target:Issue THEN '#' + toString(target.number)
          ELSE target.id
        END AS referenceKey,
        type(firstRel) AS relationship,
        pathLength AS depth,
        CASE
          WHEN seed:Commit THEN seed.sha
          WHEN seed:PullRequest THEN toString(seed.number)
          ELSE seed.id
        END AS seedSourceId
      LIMIT $limit
    `;

    try {
      const records = await this.neo4j.runQuery(cypher, {
        repositoryId,
        seedIds: seedSourceExternalIds,
        limit: neo4jInt(boundedLimit),
      });

      return records.map((record) => ({
        sourceId: record.get("targetId"),
        sourceType: record.get("targetType"),
        referenceKey: record.get("referenceKey"),
        relationship: record.get("relationship"),
        depth: Number(record.get("depth")),
        seedSourceId: record.get("seedSourceId"),
      }));
    } catch (err) {
      this.logger.warn(`Graph traversal error: ${String(err)}`);
      return [];
    }
  }
}

function neo4jInt(val: number): any {
  return val;
}
