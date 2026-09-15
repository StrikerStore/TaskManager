declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user: { id: string; name: string; email: string; image?: string | null };
      /** Set by requireTeam: the caller's membership in the team being accessed. */
      team: { id: string; slug: string; name: string; role: string };
    }
  }
}

export {};
