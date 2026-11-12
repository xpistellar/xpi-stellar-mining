/**
 * Cryptographic integrity for posts, mod actions, and role grants.
 */

import { Keypair } from "@stellar/stellar-sdk";

export function postPayload(post) {
  return [
    post.id || "",
    post.title || "",
    post.body || "",
    post.author || "",
    String(post.createdAt || 0),
    post.categoryId || "general",
  ].join("|");
}

export function signPost(secretKey, post) {
  const kp = Keypair.fromSecret(secretKey);
  const msg = Buffer.from(postPayload(post), "utf8");
  return Buffer.from(kp.sign(msg)).toString("base64");
}

export function verifyPostSignature(post) {
  if (!post?.author || !post?.signature) return false;
  try {
    const kp = Keypair.fromPublicKey(post.author);
    const sig = Buffer.from(post.signature, "base64");
    // current payload (includes categoryId)
    if (kp.verify(Buffer.from(postPayload(post), "utf8"), sig)) return true;
    // legacy payload without category (pre-category upgrade)
    const legacy = [
      post.id || "",
      post.title || "",
      post.body || "",
      post.author || "",
      String(post.createdAt || 0),
    ].join("|");
    return kp.verify(Buffer.from(legacy, "utf8"), sig);
  } catch {
    return false;
  }
}

export function modActionPayload(action) {
  return [
    action.type || "",
    action.postId || "",
    action.by || "",
    String(action.at || 0),
    action.reason || "",
  ].join("|");
}

export function signModAction(secretKey, action) {
  const kp = Keypair.fromSecret(secretKey);
  const msg = Buffer.from(modActionPayload(action), "utf8");
  return Buffer.from(kp.sign(msg)).toString("base64");
}

export function verifyModAction(action) {
  if (!action?.by || !action?.signature) return false;
  try {
    const kp = Keypair.fromPublicKey(action.by);
    const msg = Buffer.from(modActionPayload(action), "utf8");
    return kp.verify(msg, Buffer.from(action.signature, "base64"));
  } catch {
    return false;
  }
}

/** Network-wide role grant / revoke (signed by admin or super_admin) */
export function roleGrantPayload(grant) {
  return [
    grant.op || "", // grant | revoke
    grant.address || "",
    grant.role || "moderator",
    grant.by || "",
    String(grant.at || 0),
  ].join("|");
}

export function signRoleGrant(secretKey, grant) {
  const kp = Keypair.fromSecret(secretKey);
  const msg = Buffer.from(roleGrantPayload(grant), "utf8");
  return Buffer.from(kp.sign(msg)).toString("base64");
}

export function verifyRoleGrant(grant) {
  if (!grant?.by || !grant?.signature) return false;
  try {
    const kp = Keypair.fromPublicKey(grant.by);
    const msg = Buffer.from(roleGrantPayload(grant), "utf8");
    return kp.verify(msg, Buffer.from(grant.signature, "base64"));
  } catch {
    return false;
  }
}
