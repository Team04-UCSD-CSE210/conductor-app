// apps/api/routes/ui.js — enhanced layout, sidebar, modals, toasts, skeletons, dark mode
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersPath = path.resolve(__dirname, "..", "data", "users.json");
const classesPath = path.resolve(__dirname, "..", "data", "classes.json");
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return []; } };

const router = Router();

// ===== Utilities =====
const escapeHtml = (v) => (v == null ? "" : String(v)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;"));

// ===== Base HTML (sidebar layout + dark mode + toast region) =====
const baseHtml = (title, body, { extraHead = "", bodyClass = "" } = {}) => `<!doctype html>
<html lang="en" class="h-full">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title ? `${title} · Conductor` : "Conductor"}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://unpkg.com/hyperscript.org@0.9.12"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
  <style>
    :root { color-scheme: light dark; }
    .glass { backdrop-filter: blur(8px); background: rgba(255,255,255,0.6); }
    .dark .glass { background: rgba(31,41,55,0.45); }
    .card { @apply rounded-2xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700; }
    .btn { @apply inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition; }
    .btn-primary { @apply bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600; }
    .btn-ghost { @apply hover:bg-slate-100 dark:hover:bg-slate-700/60; }
    .chip { @apply inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200; }
    .input { @apply w-full bg-transparent outline-none; }
    .skeleton { @apply animate-pulse bg-slate-200/70 dark:bg-slate-700/50 rounded; }
  </style>
  ${extraHead}
</head>
<body class="h-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 ${bodyClass}">
  <div class="min-h-screen grid lg:grid-cols-[260px_1fr]">
    <!-- Sidebar -->
    <aside class="hidden lg:block border-r border-slate-200 dark:border-slate-800 p-5">
      <div class="flex items-center gap-3 mb-6">
        <div class="h-10 w-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 grid place-items-center text-white shadow">
          <i class="fa-solid fa-wave-square"></i>
        </div>
        <div>
          <div class="font-semibold tracking-tight">Conductor</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">Admin Console</div>
        </div>
      </div>
      <nav class="space-y-1">
        <a href="/view" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fa-solid fa-gauge"></i><span>Dashboard</span></a>
        <a href="/view/classes" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fa-solid fa-graduation-cap"></i><span>Classes</span></a>
        <a href="/view/users" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fa-solid fa-users"></i><span>Users</span></a>
      </nav>
      <div class="mt-6">
        <button id="themeToggle" class="btn btn-ghost w-full" onclick="document.documentElement.classList.toggle('dark');localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');">
          <i class="fa-solid fa-circle-half-stroke"></i><span>Toggle theme</span>
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="min-h-screen flex flex-col">
      <header class="lg:hidden glass sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800/70">
        <div class="px-4 py-3 flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 grid place-items-center text-white"><i class="fa-solid fa-wave-square"></i></div>
          <div class="font-semibold tracking-tight">Conductor</div>
          <button class="ml-auto btn btn-ghost" onclick="document.documentElement.classList.toggle('dark');localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');"><i class="fa-solid fa-circle-half-stroke"></i></button>
        </div>
      </header>
      <main class="p-5 md:p-8 space-y-6">${body}</main>
    </div>
  </div>

  <!-- Toast region -->
  <div id="toast" class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"></div>
  <script>
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.classList.add('dark');
    function showToast(msg){
      const el = document.createElement('div');
      el.className = 'px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow';
      el.textContent = msg; document.getElementById('toast').appendChild(el);
      setTimeout(()=>{ el.remove(); }, 1800);
    }
    document.body.addEventListener('htmx:afterRequest', (e)=>{
      const verb = e.detail?.xhr?.responseURL ? e.detail.xhr.responseURL.split('://').pop() : '';
      if(e.detail?.successful) showToast('Done');
    });
  </script>
</body>
</html>`;

// ===== Pages =====
router.get(["/", "/view"], (_req, res) => {
  const body = `
  <section class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <a class="card p-6 hover:shadow-md transition" href="/view/classes">
      <div class="flex items-center gap-4">
        <div class="h-12 w-12 rounded-xl bg-indigo-600/90 text-white grid place-items-center shadow"><i class="fa-solid fa-graduation-cap"></i></div>
        <div><div class="font-semibold">Classes</div><p class="text-slate-500 dark:text-slate-400 text-sm">Browse, search and manage classes.</p></div>
      </div>
    </a>
    <a class="card p-6 hover:shadow-md transition" href="/view/users">
      <div class="flex items-center gap-4">
        <div class="h-12 w-12 rounded-xl bg-emerald-600/90 text-white grid place-items-center shadow"><i class="fa-solid fa-users"></i></div>
        <div><div class="font-semibold">Users</div><p class="text-slate-500 dark:text-slate-400 text-sm">View and manage users.</p></div>
      </div>
    </a>
    <div class="card p-6">
      <div class="font-semibold mb-3">Quick Tips</div>
      <ul class="text-sm list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
        <li>Use the search bars to filter in real time.</li>
        <li>Buttons open lightweight modals; closing will refresh the list.</li>
        <li>Dark mode persists across sessions.</li>
      </ul>
    </div>
  </section>`;
  res.type("html").send(baseHtml("Dashboard", body));
});

// ----- Classes page -----
router.get("/view/classes", (req, res) => {
  const body = `
  <section class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-semibold tracking-tight">Classes</h2>
      <div class="flex items-center gap-2">
        <button class="btn btn-ghost" hx-get="/view/partials/classes-export" hx-trigger="click" hx-target="#toast" hx-swap="beforeend"> <i class="fa-regular fa-file-lines"></i> Export JSON </button>
        <button class="btn btn-primary" hx-get="/view/partials/class-modal" hx-target="body" hx-swap="beforeend"> <i class="fa-solid fa-plus"></i> New Class </button>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2 card">
        <div class="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <i class="fa-solid fa-magnifying-glass opacity-60"></i>
          <input type="text" placeholder="Search by code or title..." class="input"
            oninput="htmx.ajax('GET','/view/partials/classes-list?q='+encodeURIComponent(this.value),{target:'#classesList'})" />
          <div class="ml-auto text-xs text-slate-500">Grid
            <label class="inline-flex items-center gap-2 ml-2">
              <input type="checkbox" id="gridToggle" onchange="document.getElementById('classesList').classList.toggle('grid');document.getElementById('classesList').classList.toggle('divide-y');document.getElementById('classesList').classList.toggle('gap-4');document.getElementById('classesList').classList.toggle('grid-cols-2');">
            </label>
          </div>
        </div>
        <div id="classesList" class="divide-y divide-slate-100 dark:divide-slate-700" hx-get="/view/partials/classes-list" hx-trigger="load">
          ${skeletonList(6)}
        </div>
        <div id="classesPager" class="p-3 flex justify-end" hx-get="/view/partials/classes-pager" hx-trigger="load"></div>
      </div>
      <aside class="card p-5">
        <div class="font-medium mb-2">Quick stats</div>
        <div id="classesStats" hx-get="/view/partials/classes-stats" hx-trigger="load">${skeletonStats()}</div>
      </aside>
    </div>
  </section>`;
  res.type("html").send(baseHtml("Classes", body));
});

// ----- Users page -----
router.get("/view/users", (req, res) => {
  const body = `
  <section class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-semibold tracking-tight">Users</h2>
      <div class="flex items-center gap-2">
        <button class="btn btn-primary" hx-get="/view/partials/user-modal" hx-target="body" hx-swap="beforeend"> <i class="fa-solid fa-user-plus"></i> New User </button>
      </div>
    </div>

    <div class="card">
      <div class="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <i class="fa-solid fa-magnifying-glass opacity-60"></i>
        <input type="text" placeholder="Search by name or email..." class="input"
          oninput="htmx.ajax('GET','/view/partials/users-list?q='+encodeURIComponent(this.value),{target:'#usersList'})" />
      </div>
      <div id="usersList" hx-get="/view/partials/users-list" hx-trigger="load">${skeletonTable()}</div>
    </div>
  </section>`;
  res.type("html").send(baseHtml("Users", body));
});

// ===== Partials =====
// Classes list (with optional q + pagination)
router.get("/view/partials/classes-list", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = 8;
  let list = readJSON(classesPath);
  if (q) list = list.filter(c => String(c.code).toLowerCase().includes(q) || String(c.title).toLowerCase().includes(q));
  
  const start = (page - 1) * pageSize;
  const pageItems = list.slice(start, start + pageSize);

  if (!pageItems.length) return res.type("html").send(`<div class="p-6 text-sm text-slate-500">No classes found.</div>`);

  const asCards = pageItems.map(c => `
    <div class="p-4 flex items-center justify-between">
      <div class="min-w-0">
        <div class="font-medium">${escapeHtml(c.code)} · ${escapeHtml(c.title)}</div>
        <div class="text-sm text-slate-500">${escapeHtml(c.instructor || "Unknown")}</div>
        ${Array.isArray(c.tags) && c.tags.length ? `<div class="mt-2 flex flex-wrap gap-2">${c.tags.map(t=>`<span class="chip">#${escapeHtml(String(t))}</span>`).join("")}</div>` : ""}
      </div>
      <div class="flex items-center gap-2">
        <a href="/api/v1/classes/${encodeURIComponent(c.code)}" target="_blank" class="btn btn-ghost"><i class="fa-regular fa-file-lines"></i> JSON</a>
        <button class="btn btn-ghost" hx-get="/view/partials/class-modal?code=${encodeURIComponent(c.code)}" hx-target="body" hx-swap="beforeend"><i class="fa-regular fa-pen-to-square"></i> Edit</button>
        <button class="btn btn-ghost" hx-delete="/api/v1/classes/${encodeURIComponent(c.code)}" hx-on::after-request="htmx.ajax('GET','/view/partials/classes-list?page=${page}',{target:'#classesList'}); showToast('Deleted')"><i class="fa-regular fa-trash-can"></i></button>
      </div>
    </div>`).join("");

  // If toggled to grid via JS, these classes will switch styles
  const containerClass = `grid grid-cols-2 gap-4`; // applied by toggle; default gets overridden in page
  const listHtml = `<div class="${containerClass}">${asCards}</div>`;

  res.type("html").send(listHtml);
});

router.get("/view/partials/classes-pager", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = 8;
  let list = readJSON(classesPath);
  if (q) list = list.filter(c => String(c.code).toLowerCase().includes(q) || String(c.title).toLowerCase().includes(q));
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return res.type("html").send("");
  const pager = `<div class="inline-flex gap-2">
    ${Array.from({length: pages}, (_,i)=>{
      const p=i+1; const active=p===page;
      return `<button class="btn ${active? 'btn-primary' : 'btn-ghost'}" hx-get="/view/partials/classes-list?page=${p}" hx-target="#classesList">${p}</button>`;
    }).join("")}
  </div>`;
  res.type("html").send(pager);
});

router.get("/view/partials/classes-stats", (_req, res) => {
  const list = readJSON(classesPath);
  const total = list.length;
  const instructors = new Set(list.map(c => c.instructor).filter(Boolean));
  const tags = new Set(list.flatMap(c => Array.isArray(c.tags) ? c.tags : []));
  const html = `
    <ul class="text-sm space-y-2">
      <li class="flex items-center justify-between"><span>Total classes</span><span class="font-medium">${total}</span></li>
      <li class="flex items-center justify-between"><span>Instructors</span><span class="font-medium">${instructors.size}</span></li>
      <li class="flex items-center justify-between"><span>Unique tags</span><span class="font-medium">${tags.size}</span></li>
    </ul>`;
  res.type("html").send(html);
});

// Users list
router.get("/view/partials/users-list", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  let list = readJSON(usersPath);
  if (q) list = list.filter(u => String(u.name).toLowerCase().includes(q) || String(u.email).toLowerCase().includes(q));
  if (!list.length) return res.type("html").send(`<div class="p-6 text-sm text-slate-500">No users found.</div>`);

  const html = `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 dark:bg-slate-900/40">
          <tr>
            <th class="text-left font-medium px-4 py-2">ID</th>
            <th class="text-left font-medium px-4 py-2">Name</th>
            <th class="text-left font-medium px-4 py-2">Email</th>
            <th class="text-left font-medium px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
          ${list.map(u => `
            <tr>
              <td class="px-4 py-2">${escapeHtml(u.id)}</td>
              <td class="px-4 py-2">${escapeHtml(u.name || "-")}</td>
              <td class="px-4 py-2">${escapeHtml(u.email || "-")}</td>
              <td class="px-4 py-2 flex gap-2">
                <a href="/api/v1/users/${encodeURIComponent(u.id)}" target="_blank" class="btn btn-ghost"><i class="fa-regular fa-file-lines"></i> JSON</a>
                <button class="btn btn-ghost" hx-get="/view/partials/user-modal?id=${encodeURIComponent(u.id)}" hx-target="body" hx-swap="beforeend"><i class="fa-regular fa-pen-to-square"></i> Edit</button>
                <button class="btn btn-ghost" hx-delete="/api/v1/users/${encodeURIComponent(u.id)}" hx-on::after-request="htmx.ajax('GET','/view/partials/users-list',{target:'#usersList'}); showToast('Deleted')"><i class="fa-regular fa-trash-can"></i></button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  res.type("html").send(html);
});

// Export (demo)
router.get("/view/partials/classes-export", (_req, res) => {
  const list = readJSON(classesPath);
  const blob = escapeHtml(JSON.stringify(list, null, 2));
  res.type("html").send(`<div class="hidden">${blob}</div><script>showToast('Exported: ${list.length} items');</script>`);
});

// ===== Modals (create/edit) =====
router.get("/view/partials/class-modal", (req, res) => {
  const code = req.query.code;
  const list = readJSON(classesPath);
  const current = code ? list.find(c => String(c.code).toLowerCase() === String(code).toLowerCase()) : null;
  const isEdit = Boolean(current);
  const title = isEdit ? `Edit Class · ${escapeHtml(current.code)}` : 'New Class';
  const value = (k, d='') => escapeHtml((current && current[k]) ?? d);
  const tagsValue = Array.isArray(current?.tags) ? current.tags.join(', ') : '';
  const method = isEdit ? 'PUT' : 'POST';
  const action = isEdit ? `/api/v1/classes/${encodeURIComponent(current.code)}` : '/api/v1/classes';

  const html = `
  <div class="fixed inset-0 z-50 grid place-items-center p-4" hx-on::after-request="document.getElementById('modal').remove(); htmx.ajax('GET','/view/partials/classes-list',{target:'#classesList'}); showToast('Saved')">
    <div class="absolute inset-0 bg-black/40" onclick="this.parentElement.remove()"></div>
    <div id="modal" class="card w-full max-w-lg overflow-hidden">
      <div class="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div class="font-semibold">${title}</div>
        <button class="btn btn-ghost" onclick="document.getElementById('modal').parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form class="p-5 grid gap-4" hx-${method.toLowerCase()}="${action}" hx-target="closest .card" hx-swap="outerHTML">
        ${!isEdit ? `<div><label class="block text-sm mb-1">Code</label><input name="code" required class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2" value="${value('code')}"></div>` : ''}
        <div><label class="block text-sm mb-1">Title</label><input name="title" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2" value="${value('title')}"></div>
        <div><label class="block text-sm mb-1">Instructor</label><input name="instructor" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2" value="${value('instructor')}"></div>
        <div><label class="block text-sm mb-1">Tags (comma separated)</label><input name="tags" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2" value="${escapeHtml(tagsValue)}"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal').parentElement.remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  </div>`;
  res.type("html").send(html);
});

router.get("/view/partials/user-modal", (req, res) => {
  const id = req.query.id;
  const list = readJSON(usersPath);
  const current = id ? list.find(u => String(u.id) === String(id)) : null;
  const isEdit = Boolean(current);
  const title = isEdit ? `Edit User · ${escapeHtml(current.name || current.id)}` : 'New User';
  const value = (k, d='') => escapeHtml((current && current[k]) ?? d);
  const method = isEdit ? 'PUT' : 'POST';
  const action = isEdit ? `/api/v1/users/${encodeURIComponent(current?.id)}` : '/api/v1/users';

  const html = `
  <div class="fixed inset-0 z-50 grid place-items-center p-4" hx-on::after-request="document.getElementById('modal-user').remove(); htmx.ajax('GET','/view/partials/users-list',{target:'#usersList'}); showToast('Saved')">
    <div class="absolute inset-0 bg-black/40" onclick="this.parentElement.remove()"></div>
    <div id="modal-user" class="card w-full max-w-lg overflow-hidden">
      <div class="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div class="font-semibold">${title}</div>
        <button class="btn btn-ghost" onclick="document.getElementById('modal-user').parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form class="p-5 grid gap-4" hx-${method.toLowerCase()}="${action}" hx-target="closest .card" hx-swap="outerHTML">
        ${isEdit ? '' : `<div><label class="block text-sm mb-1">ID (optional)</label><input name="id" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2" value=""></div>`}
        <div><label class="block text-sm mb-1">Name</label><input name="name" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2" value="${value('name')}"></div>
        <div><label class="block text-sm mb-1">Email</label><input name="email" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2" value="${value('email')}"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-user').parentElement.remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  </div>`;
  res.type("html").send(html);
});

// ===== Skeletons =====
function skeletonList(n){
  return Array.from({length:n}).map(()=>`<div class="p-4 space-y-2">
    <div class="h-4 w-40 skeleton"></div>
    <div class="h-3 w-56 skeleton"></div>
    <div class="h-6 w-28 skeleton"></div>
  </div>`).join("");
}
function skeletonStats(){
  return `<div class="space-y-2">
    <div class="h-4 w-40 skeleton"></div>
    <div class="h-4 w-28 skeleton"></div>
    <div class="h-4 w-24 skeleton"></div>
  </div>`;
}
function skeletonTable(){
  return `<div class="p-4 space-y-3">
    <div class="h-6 w-1/2 skeleton"></div>
    <div class="h-6 w-2/3 skeleton"></div>
    <div class="h-6 w-3/4 skeleton"></div>
  </div>`;
}

export default router;
