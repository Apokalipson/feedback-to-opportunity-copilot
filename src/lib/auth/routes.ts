export const LOGIN_PATH = "/login";
export const WORKSPACE_PATH = "/workspace";

export function isProtectedPath(pathname: string) {
  return (
    pathname === WORKSPACE_PATH || pathname.startsWith(`${WORKSPACE_PATH}/`)
  );
}
