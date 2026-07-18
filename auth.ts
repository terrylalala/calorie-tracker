import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js configuration.
 *
 * Sessions are JWTs in an encrypted cookie (no session table needed). The
 * Google account's stable `sub` becomes our user id, and is what every row in
 * the database is scoped to.
 *
 * Signing in is NOT the same as having access: a signed-in account still has to
 * be registered with the invite code before it can read or write any data
 * (see lib/session.ts + /api/account).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      // Persist the Google subject id on the token as our canonical user id.
      if (profile?.sub) token.sub = profile.sub;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
});
