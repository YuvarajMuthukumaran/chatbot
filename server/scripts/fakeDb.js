// A small in-memory stand-in for the slice of the MongoDB driver API this app
// uses (find/sort/project, findOne, insertOne, updateOne with upsert,
// distinct, unique + partial indexes). Used by the test suite and by
// `npm run dev:sandbox`, so booking can be exercised end to end without
// touching the shared Atlas database the deployed app also uses.
//
// It mimics the behaviors the app depends on — including rejecting an
// invalid $regex and raising E11000 on a unique-index clash — but it is not
// a general-purpose MongoDB emulator.
import { ObjectId } from "mongodb";

function getPath(doc, path) {
  return path.split(".").reduce((value, key) => value?.[key], doc);
}

function same(a, b) {
  if (a instanceof ObjectId || b instanceof ObjectId) return String(a) === String(b);
  return a === b;
}

function isOperatorObject(cond) {
  return cond && typeof cond === "object" && !(cond instanceof ObjectId) && !Array.isArray(cond) && Object.keys(cond).some((k) => k.startsWith("$"));
}

function matchValue(actual, cond) {
  if (isOperatorObject(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case "$regex": {
          const re = new RegExp(arg, cond.$options || ""); // throws on an invalid pattern, like the server would
          return Array.isArray(actual) ? actual.some((v) => re.test(v)) : typeof actual === "string" && re.test(actual);
        }
        case "$options":
          return true;
        case "$in":
          return arg.some((v) => (Array.isArray(actual) ? actual.some((a) => same(a, v)) : same(actual, v)));
        case "$ne":
          return !same(actual, arg);
        case "$gte":
          return actual >= arg;
        case "$gt":
          return actual > arg;
        case "$lte":
          return actual <= arg;
        case "$lt":
          return actual < arg;
        default:
          throw new Error(`fakeDb: unsupported query operator ${op}`);
      }
    });
  }
  if (Array.isArray(actual) && !Array.isArray(cond)) return actual.some((a) => same(a, cond));
  return same(actual, cond);
}

function matches(doc, query = {}) {
  return Object.entries(query).every(([path, cond]) => matchValue(getPath(doc, path), cond));
}

class FakeCursor {
  constructor(docs) {
    this.docs = docs;
    this.sortSpec = null;
    this.projection = null;
    this.limitCount = 0;
  }

  sort(spec) {
    this.sortSpec = spec;
    return this;
  }

  project(spec) {
    this.projection = spec;
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  async toArray() {
    let docs = this.docs.map((d) => ({ ...d }));
    if (this.sortSpec) {
      const keys = Object.entries(this.sortSpec);
      docs.sort((a, b) => {
        for (const [key, dir] of keys) {
          const av = getPath(a, key);
          const bv = getPath(b, key);
          if (av < bv) return -dir;
          if (av > bv) return dir;
        }
        return 0;
      });
    }
    if (this.limitCount) docs = docs.slice(0, this.limitCount);
    if (this.projection) {
      docs = docs.map((d) => {
        const out = { _id: d._id };
        for (const [key, include] of Object.entries(this.projection)) if (include) out[key] = d[key];
        return out;
      });
    }
    return docs;
  }
}

class FakeCollection {
  constructor() {
    this.docs = [];
    this.uniqueIndexes = [];
  }

  async createIndex(keys, options = {}) {
    if (options.unique) this.uniqueIndexes.push({ fields: Object.keys(keys), partial: options.partialFilterExpression });
    return Object.keys(keys).join("_");
  }

  find(query = {}) {
    return new FakeCursor(this.docs.filter((d) => matches(d, query)));
  }

  async findOne(query = {}) {
    const doc = this.docs.find((d) => matches(d, query));
    return doc ? { ...doc } : null;
  }

  async insertOne(doc) {
    const stored = { _id: new ObjectId(), ...doc };
    this.assertUnique(stored);
    this.docs.push(stored);
    return { acknowledged: true, insertedId: stored._id };
  }

  async updateOne(filter, update, { upsert = false } = {}) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (doc) {
      const updated = { ...doc, ...update.$set };
      this.assertUnique(updated, doc);
      Object.assign(doc, update.$set);
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }
    if (!upsert) return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };

    const equalityFields = Object.fromEntries(Object.entries(filter).filter(([, v]) => !isOperatorObject(v)));
    const created = { _id: new ObjectId(), ...equalityFields, ...update.$setOnInsert, ...update.$set };
    this.assertUnique(created);
    this.docs.push(created);
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: created._id };
  }

  async distinct(field) {
    const values = new Set();
    for (const doc of this.docs) {
      const value = getPath(doc, field);
      for (const v of Array.isArray(value) ? value : [value]) if (v !== undefined) values.add(v);
    }
    return [...values];
  }

  assertUnique(candidate, self = null) {
    for (const index of this.uniqueIndexes) {
      if (index.partial && !matches(candidate, index.partial)) continue;
      const clash = this.docs.find(
        (d) =>
          d !== self &&
          (!index.partial || matches(d, index.partial)) &&
          index.fields.every((f) => same(getPath(d, f), getPath(candidate, f)))
      );
      if (clash) throw Object.assign(new Error(`E11000 duplicate key error (fake index on ${index.fields.join(", ")})`), { code: 11000 });
    }
  }
}

export function createFakeDb() {
  const collections = new Map();
  return {
    collection(name) {
      if (!collections.has(name)) collections.set(name, new FakeCollection());
      return collections.get(name);
    },
    async command() {
      return { ok: 1 };
    },
  };
}
