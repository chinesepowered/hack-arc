import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "./lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/sign-in" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        handle: {},
        password: {},
      },
      async authorize(raw) {
        const parsed = z
          .object({
            handle: z.string().min(2).max(64),
            password: z.string().min(4).max(128),
          })
          .safeParse(raw);
        if (!parsed.success) return null;
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.handle, parsed.data.handle.toLowerCase()))
          .limit(1);
        if (!user) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          name: user.displayName ?? user.handle,
          handle: user.handle,
          walletId: user.walletId ?? undefined,
          walletAddress: user.walletAddress ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        // propagate extras from authorize()
        const u = user as typeof user & {
          handle?: string;
          walletId?: string;
          walletAddress?: string;
        };
        token.handle = u.handle;
        token.walletId = u.walletId;
        token.walletAddress = u.walletAddress;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      // @ts-expect-error — augmenting session with custom fields
      session.user.handle = token.handle;
      // @ts-expect-error
      session.user.walletId = token.walletId;
      // @ts-expect-error
      session.user.walletAddress = token.walletAddress;
      return session;
    },
  },
});
