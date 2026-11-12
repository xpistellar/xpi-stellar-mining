/** Nested phpBB-style categories (parentId for subforums) — English, Reddit-inspired */

export const DEFAULT_CATEGORIES = [
  {
    id: "section-official",
    name: "Official",
    description: "Announcements, rules, and site meta",
    order: 10,
    parentId: null,
  },
  {
    id: "announcements",
    name: "Announcements",
    description: "Official news from moderators and project leads",
    order: 11,
    parentId: "section-official",
  },
  {
    id: "rules",
    name: "Rules & Rediquette",
    description: "Community standards inspired by Reddit Rediquette",
    order: 12,
    parentId: "section-official",
  },
  {
    id: "section-community",
    name: "Community",
    description: "Open discussion",
    order: 20,
    parentId: null,
  },
  {
    id: "general",
    name: "General Discussion",
    description: "Anything on-topic that does not fit elsewhere",
    order: 21,
    parentId: "section-community",
  },
  {
    id: "help",
    name: "Help & Support",
    description: "Ask questions — search first, be specific",
    order: 22,
    parentId: "section-community",
  },
  {
    id: "feedback",
    name: "Feedback & Ideas",
    description: "Product feedback, feature requests, constructive critique",
    order: 23,
    parentId: "section-community",
  },
  {
    id: "offtopic",
    name: "Off-Topic",
    description: "Casual chat — still civil, still no spam",
    order: 24,
    parentId: "section-community",
  },
  {
    id: "section-chain",
    name: "Stellar & XPi",
    description: "On-chain economy, staking, and digital gold",
    order: 30,
    parentId: null,
  },
  {
    id: "stellar",
    name: "XPi · Digital Gold",
    description: "Tokenomics, staking, philosophy, and verification",
    order: 31,
    parentId: "section-chain",
  },
  {
    id: "tech",
    name: "Tech & P2P Nodes",
    description: "Nodes, WebRTC, virtual disk, developers",
    order: 32,
    parentId: "section-chain",
  },
  {
    id: "market",
    name: "Marketplace",
    description: "Peer offers — follow the rules, no scams",
    order: 40,
    parentId: null,
  },
];

export function ensureCategories(db) {
  if (!Array.isArray(db.categories) || db.categories.length === 0) {
    db.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  } else {
    // Merge any missing default ids (upgrade path)
    const have = new Set(db.categories.map((c) => c.id));
    for (const c of DEFAULT_CATEGORIES) {
      if (!have.has(c.id)) db.categories.push({ ...c });
    }
  }
  for (const c of db.categories) {
    if (c.parentId === undefined) c.parentId = null;
  }
  return db.categories;
}

export function getCategory(db, id) {
  ensureCategories(db);
  return db.categories.find((c) => c.id === id) || null;
}

export function categoryStats(db, posts) {
  ensureCategories(db);
  const by = {};
  for (const c of db.categories) {
    by[c.id] = { category: c, topics: 0, posts: 0, lastPost: null, children: [] };
  }
  for (const p of posts) {
    const cid = p.categoryId || "general";
    if (!by[cid]) {
      by[cid] = {
        category: { id: cid, name: cid, description: "", order: 999, parentId: null },
        topics: 0,
        posts: 0,
        lastPost: null,
        children: [],
      };
    }
    by[cid].topics += 1;
    by[cid].posts += 1;
    if (!by[cid].lastPost || p.createdAt > by[cid].lastPost.createdAt) {
      by[cid].lastPost = {
        id: p.id,
        title: p.title,
        author: p.author,
        createdAt: p.createdAt,
      };
    }
  }

  const roots = [];
  for (const row of Object.values(by)) {
    const pid = row.category.parentId;
    if (pid && by[pid]) {
      by[pid].children.push(row);
    } else if (!pid) {
      roots.push(row);
    } else {
      roots.push(row);
    }
  }

  function sortRec(list) {
    list.sort((a, b) => (a.category.order || 100) - (b.category.order || 100));
    for (const r of list) sortRec(r.children || []);
  }
  sortRec(roots);

  const flat = Object.values(by).sort(
    (a, b) => (a.category.order || 100) - (b.category.order || 100)
  );

  return { tree: roots, flat };
}
