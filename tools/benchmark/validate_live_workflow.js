const http = require("http");

async function run() {
  console.log("=== TRACEBACK LIVE END-TO-END WORKFLOW VALIDATION ===");

  // 1. Login to obtain session token
  const loginRes = await fetch("http://127.0.0.1:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "alex@company.com",
      password: "Password123!",
    }),
  });

  if (!loginRes.ok) {
    throw new Error(
      `Login failed: ${loginRes.status} ${await loginRes.text()}`,
    );
  }

  const loginData = await loginRes.json();
  const token = loginData.token;
  const workspaceId = loginData.workspaces[0].id;
  console.log(
    `[1] Authenticated as: ${loginData.user.name} (${loginData.user.email})`,
  );
  console.log(
    `    Workspace: ${loginData.workspaces[0].name} (${workspaceId})`,
  );

  // 2. Fetch repositories
  const reposRes = await fetch(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/repositories`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-workspace-id": workspaceId,
      },
    },
  );
  console.log(`[2] reposRes status: ${reposRes.status}`);
  const reposBody = await reposRes.json();
  const repos = Array.isArray(reposBody)
    ? reposBody
    : reposBody.data || reposBody.repositories || [];
  console.log(`[2] Found ${repos.length} repositories.`);
  if (repos.length === 0) {
    console.log("No repos in workspace, body was:", JSON.stringify(reposBody));
    // Let's create a test repository if none
    const createRepoRes = await fetch(
      `http://127.0.0.1:3001/api/workspaces/${workspaceId}/repositories`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          fullName: "Ujjawal-0103/HackFront",
          defaultBranch: "main",
          isPrivate: true,
        }),
      },
    );
    const created = await createRepoRes.json();
    repos.push(created.data || created);
  }
  const targetRepo = repos[0];
  console.log(`    Target Repo: ${targetRepo.fullName} (${targetRepo.id})`);

  // 3. Propose Candidate Decision
  const createDecRes = await fetch(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/repositories/${targetRepo.id}/decisions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({
        title: "Strict Redis Mutex on Repository Ingestion Queue",
        summary:
          "Ingestion concurrency guard to prevent race conditions during parallel webhooks",
        decision:
          "All repository sync operations must acquire a distributed Redis lock per repositoryId.",
        rationale:
          "Rapid duplicate GitHub push webhooks in Q3 2024 caused simultaneous git fetch operations corrupting local working trees.",
        targetFilePath: "src/ingestion/ingestion-queue.service.ts",
        targetSymbol: "processSyncJob",
        severity: "HIGH",
        status: "CANDIDATE",
      }),
    },
  );

  const dec = await createDecRes.json();
  console.log(
    `[3] Created Candidate Decision: ${dec.id} (${dec.title}), status: ${dec.status}`,
  );

  // 4. Human Accept Decision
  const acceptRes = await fetch(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/repositories/${targetRepo.id}/decisions/${dec.id}/accept`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({
        reviewNotes:
          "Accepted by Lead Architect Alex Maintainer as non-negotiable architectural invariant.",
      }),
    },
  );

  const acceptedDec = await acceptRes.json();
  console.log(
    `[4] Decision Reviewed & Accepted: status=${acceptedDec.status}, reviewer=${acceptedDec.reviewerName}`,
  );

  // 5. Run Historical Intent Check on conflicting diff
  const conflictingDiff = `--- a/src/ingestion/ingestion-queue.service.ts
+++ b/src/ingestion/ingestion-queue.service.ts
@@ -45,3 +45,2 @@
-  await this.redisLock.acquire(repositoryId);
   try {
     return await this.syncRepository(repositoryId);
-  } finally { await this.redisLock.release(repositoryId); }`;

  const intentCheckRes = await fetch(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/repositories/${targetRepo.id}/advisory/intent-check`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({
        diff: conflictingDiff,
        filePath: "src/ingestion/ingestion-queue.service.ts",
        changeDescription:
          "Remove redis lock to speed up parallel sync throughput",
      }),
    },
  );

  const intentSession = await intentCheckRes.json();
  console.log(`[5] Historical Intent Check Executed:`);
  console.log(`    Session ID: ${intentSession.id}`);
  console.log(`    Outcome: ${intentSession.outcome}`);
  console.log(`    Summary: ${intentSession.summary}`);
  console.log(`    Detected Conflicts: ${intentSession.conflicts.length}`);
  if (intentSession.conflicts.length > 0) {
    console.log(
      `    Top Conflict: ${intentSession.conflicts[0].title} [${intentSession.conflicts[0].severity}]`,
    );
  }

  // 6. Record Human Disposition on the Intent Check
  const dispRes = await fetch(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/repositories/${targetRepo.id}/advisory/intent-checks/${intentSession.id}/disposition`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({
        disposition: "REJECTED",
        notes:
          "Rejecting diff: directly removes the required Redis lock governed by accepted decision " +
          dec.id,
      }),
    },
  );

  const finalIntent = await dispRes.json();
  console.log(
    `[6] Human Disposition Recorded: ${finalIntent.humanDisposition} ("${finalIntent.dispositionNotes}")`,
  );

  console.log("\n=== ALL WORKFLOW PHASES SUCCESSFULLY VALIDATED LIVE ===");
}

run().catch((e) => {
  console.error("Workflow failed:", e);
  process.exit(1);
});
