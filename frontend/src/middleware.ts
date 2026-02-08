import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  isAuthenticatedNextjs,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/login", "/billing"]);

export default convexAuthNextjsMiddleware(async (req) => {
  if (!isPublicRoute(req) && !(await isAuthenticatedNextjs())) {
    return nextjsMiddlewareRedirect(req, "/login");
  }
}, { verbose: true });

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
