# Ordered post media

This is a minimal additive extension to the existing private post flow. It does not add public audiences, group communities, albums as a separate product or new matching rules. Chat, snaps, stories and profile gallery requests retain their existing single-media payloads.

## Create and retry

Upload each file through authenticated `POST /v1/media` using the multipart field `file`. It returns `{ id, kind }`. Publish through authenticated `POST /v1/posts`:

```json
{
  "body": "A moment to share",
  "mediaIds": ["<uploaded-image-uuid>", "<another-uploaded-image-uuid>"],
  "clientId": "<stable-publish-uuid>"
}
```

- `body` is a required string, trimmed and limited to 2,000 characters. Text-only posts remain supported; at least text or an attachment is required.
- `mediaIds` is optional, ordered and limited to six unique UUIDs. Multiple attachments must all be images. One image or one video is supported; mixed image/video posts and multiple videos are rejected.
- Legacy `mediaId` remains accepted as an optional UUID or null. Do not supply a non-null `mediaId` together with `mediaIds`.
- `clientId` is an optional UUID for compatibility; the current composer supplies it. Retry with the same author, identifier, trimmed text and attachment IDs in the same order. The server returns the existing `{ id }` without duplicating the post. A changed payload with that identifier is rejected. The composer retains successful upload IDs during retry and creates a new publish identifier when the draft changes.

Only the current actor's uploaded media can be claimed. `ownMedia` claims an unassigned upload for the `post` purpose, or accepts an upload already assigned to that same purpose. Media assigned to private chat, snaps, stories or profile purposes cannot be repurposed into a post; upload a new copy for the intended audience. Claiming and creating the attachment links occur in the same database transaction.

## Projection and compatibility

Migration `006_post_media.sql` adds `post_media(post_id, media_id, position)` with positions 0–5, unique attachment/order constraints and cascading foreign keys. Existing `posts.media_id` values are backfilled at position 0. Existing posts are preserved.

Feed, post detail, saved posts and shared-post detail use the same projection. Each post includes ordered `media: [{ id, kind, position }]`. Legacy `media_id` and `kind` still describe the first attachment, or are null for text-only posts. Older clients can display that first attachment; current clients use `media[]` for the photo carousel. Account export includes the ordered links as `postMedia` alongside the existing post and media records.

## Private playback and previews

Media remains available through authenticated `GET /v1/media/:id`. `?thumbnail=1` returns a video's generated JPEG poster after the same authorization check; images return their existing image representation. A missing poster returns 404. Poster files have no public delivery path. Responses use `Cache-Control: private, no-store` and support authorized byte-range delivery.

Owners can read their post attachments. Currently authorized mutual matches can read them while the author's posts are visible. Blocks, suspension and revoked matches retain their existing server checks. Discovery access remains confined to eligible profile media; it does not grant access to post attachments. Sharing a post into Chat still requires both sender and recipient to be authorized to view the original post. This extension does not expand that audience.

The existing upload limits remain 20 MiB per file. Images are decoded with a 40-megapixel input limit, stripped/re-encoded as JPEG and resized inside 1,440 × 1,440. Supported videos must be valid MP4/MOV/WebM input, at most 30 seconds; the server transcodes to MP4 and creates the private poster. Thumbnails do not bypass these upload checks.

## Retention

Every linked `post_media` item now counts as a live reference during cleanup. Deleting an author's post cascades its attachment links; valid references from other records continue to retain the media. Unreferenced media older than 24 hours is eligible for the existing cleanup job, which runs once per minute while the API is running. Removing a video also attempts to remove its poster. Account deletion removes owned media records and attempts to remove their files and posters. This describes live beta storage, not a completed production backup/retention policy.

See [verification](verification.md) for executed checks and remaining native/provider validation.
