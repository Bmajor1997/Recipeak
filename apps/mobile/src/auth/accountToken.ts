/** Capture the account before awaiting a token so an account switch cannot change its owner. */
export async function account_token(
  user: { uid: string; get_token(): Promise<string> } | null,
  expected_uid?: string,
): Promise<string | null> {
  if (!user || (expected_uid && user.uid !== expected_uid)) return null;
  return user.get_token();
}
