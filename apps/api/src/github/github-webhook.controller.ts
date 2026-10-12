import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { GitHubWebhookService } from "./github-webhook.service";

/**
 * Public webhook receiver for GitHub App and repository events.
 * Authenticated via timing-safe HMAC-SHA256 X-Hub-Signature-256 verification over raw request bytes.
 */
@Controller(["github/webhook", "webhooks/github"])
export class GitHubWebhookController {
  constructor(private readonly webhookService: GitHubWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature?: string,
    @Headers("x-github-event") event?: string,
    @Headers("x-github-delivery") deliveryId?: string,
    @Body() payload?: any,
  ) {
    const rawBody = req.rawBody;

    return this.webhookService.handleWebhookDelivery(
      { event, deliveryId, signature },
      rawBody,
      payload,
    );
  }
}
