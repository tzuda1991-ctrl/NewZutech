const crypto = require('crypto');

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeUrl = value => /^https?:\/\//i.test(String(value || '')) ? String(value).trim() : '';
const statuses = ['new', 'reviewing', 'quoted', 'in_progress', 'complete', 'closed'];
const statusLabel = value => ({ new: 'New', reviewing: 'Reviewing', quoted: 'Quoted', in_progress: 'In progress', complete: 'Complete', closed: 'Closed' }[value] || value);

function cookieValue(header, name) {
  const item = String(header || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}
function signature(value) { return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'missing-admin-secret').update(value).digest('base64url'); }
function createSession() {
  const data = Buffer.from(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, csrf: crypto.randomBytes(24).toString('base64url') })).toString('base64url');
  return { token: `${data}.${signature(data)}`, csrf: JSON.parse(Buffer.from(data, 'base64url').toString()).csrf };
}
function readSession(req) {
  const token = cookieValue(req.headers.cookie, 'zt_admin');
  const [data, signed] = token.split('.');
  if (!data || !signed) return null;
  const expected = Buffer.from(signature(data));
  const actual = Buffer.from(signed);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(data, 'base64url').toString());
    return session.exp > Date.now() ? session : null;
  } catch { return null; }
}
function setSession(res, token, maxAge = 28800) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `zt_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${maxAge}${secure}`);
}
function csrfValid(req) {
  const session = req.adminSession;
  const sent = String(req.body?.csrf || '');
  const expected = Buffer.from(session?.csrf || '');
  const actual = Buffer.from(sent);
  const origin = req.get('origin');
  const host = req.get('host');
  return !!session && expected.length === actual.length && expected.length > 0 && crypto.timingSafeEqual(expected, actual) && (!origin || origin === `${req.protocol}://${host}`);
}
const field = (name, label, value = '', type = 'text', hint = '') => `<label class="admin-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}">${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
const area = (name, label, value = '', rows = 5, hint = '') => `<label class="admin-field"><span>${esc(label)}</span><textarea name="${esc(name)}" rows="${rows}">${esc(value)}</textarea>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
const select = (name, label, value, options) => `<label class="admin-field"><span>${esc(label)}</span><select name="${esc(name)}">${options.map(([key, text]) => `<option value="${esc(key)}" ${value === key ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;

function loginPage(error = '') {
  const configured = !!process.env.ADMIN_PASSWORD;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin sign in | ZuTech</title><link rel="stylesheet" href="/admin.css"></head><body class="login-page"><main class="login-card"><a class="admin-brand" href="/">Z<span>U</span>TECH</a><div class="admin-kicker">SECURE ADMINISTRATION</div><h1>Welcome back.</h1><p>Sign in to manage your website and customer enquiries.</p>${!configured ? '<div class="notice notice-danger">Admin sign-in is not configured. Add <code>ADMIN_PASSWORD</code> to the NewZutech service variables in Railway.</div>' : ''}${error ? `<div class="notice notice-danger">${esc(error)}</div>` : ''}<form method="post" action="/admin/login"><label>Admin username<input name="username" autocomplete="username" required value="admin"></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><button class="admin-button admin-button-primary" ${!configured ? 'disabled' : ''}>Sign in <span>→</span></button></form><a class="login-back" href="/">← Return to website</a></main></body></html>`;
}

function shell(title, active, body, csrf) {
  const nav = [['/', 'Overview', '◫'], ['/enquiries', 'Enquiries', '✉'], ['/services', 'Services', '◇'], ['/portfolio', 'Portfolio', '▧'], ['/settings', 'Business profile', '⚙'], ['/policies', 'Policies', '≡'], ['/invoices', 'Invoices & payments', '₹']];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} | ZuTech Admin</title><link rel="stylesheet" href="/admin.css"></head><body class="admin-page"><aside class="admin-sidebar"><a class="admin-brand" href="/">Z<span>U</span>TECH<small>STUDIO CONSOLE</small></a><div class="sidebar-label">WORKSPACE</div><nav>${nav.map(([href, label, symbol]) => `<a class="${active === href ? 'active' : ''}" href="/admin${href === '/' ? '' : href}"><i>${symbol}</i>${label}</a>`).join('')}</nav><div class="sidebar-bottom"><a class="sidebar-site" href="/" target="_blank" rel="noreferrer">View website ↗</a><form method="post" action="/admin/logout"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="logout-button">Sign out</button></form><small>Private workspace · ZuTech</small></div></aside><main class="admin-main"><header class="admin-topbar"><div><span class="admin-kicker">WEBSITE MANAGEMENT</span><h1>${esc(title)}</h1></div><div class="admin-user"><span class="user-avatar">Z</span><span><b>Administrator</b><small>Website owner</small></span></div></header>${body}<footer class="admin-footer">ZuTech Studio Console <span>Website content and customer data are private.</span></footer></main></body></html>`;
}

function notice(message, kind = 'success') { return message ? `<div class="notice notice-${kind}">${esc(message)}</div>` : ''; }
function fmtDate(value) { return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—'; }
function money(paise) { return `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

module.exports = function createAdminRouter({ express, db }) {
  const router = express.Router();
  const loginAttempts = new Map();
  router.get('/admin/login', (req, res) => res.send(loginPage()));
  router.post('/admin/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const attempts = loginAttempts.get(ip) || { count: 0, since: Date.now() };
    if (Date.now() - attempts.since > 15 * 60 * 1000) { attempts.count = 0; attempts.since = Date.now(); }
    if (attempts.count >= 6) return res.status(429).send(loginPage('Too many attempts. Wait 15 minutes, then try again.'));
    const user = String(req.body.username || '');
    const pass = String(req.body.password || '');
    const expectedUser = process.env.ADMIN_USERNAME || 'admin';
    const expectedPass = process.env.ADMIN_PASSWORD || '';
    const a = Buffer.from(`${user}\n${pass}`);
    const b = Buffer.from(`${expectedUser}\n${expectedPass}`);
    const valid = expectedPass && a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!valid) {
      attempts.count += 1; loginAttempts.set(ip, attempts);
      return res.status(401).send(loginPage('Username or password is incorrect.'));
    }
    loginAttempts.delete(ip);
    const session = createSession();
    setSession(res, session.token);
    res.redirect(303, '/admin');
  });
  router.use('/admin', (req, res, next) => {
    if (req.path === '/login') return next();
    req.adminSession = readSession(req);
    if (!req.adminSession) return res.redirect(303, '/admin/login');
    if (req.method !== 'GET' && req.method !== 'HEAD' && !csrfValid(req)) return res.status(403).send('Request could not be verified. Return to the admin page and try again.');
    if (!db) return res.status(503).send('Database is not configured.');
    next();
  });
  router.post('/admin/logout', (req, res) => { setSession(res, '', 0); res.redirect(303, '/admin/login'); });

  router.get('/admin', async (req, res, next) => {
    try {
      const [inquiriesResult, servicesResult, portfolioResult, invoicesResult, recent, settings] = await Promise.all([
        db.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE status='new')::int AS new FROM enquiries"),
        db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE trim(price_label)='')::int AS missing_price FROM services WHERE active=true"),
        db.query('SELECT count(*)::int AS total FROM portfolio WHERE published=true'),
        db.query("SELECT count(*)::int AS total, coalesce(sum(amount_paise) FILTER (WHERE status='paid'),0)::bigint AS paid FROM invoices"),
        db.query('SELECT id,name,email,phone,project_type,status,created_at FROM enquiries ORDER BY created_at DESC LIMIT 6'),
        db.query('SELECT key,value FROM site_settings'),
      ]);
      const inq = inquiriesResult.rows[0];
      const service = servicesResult.rows[0];
      const work = portfolioResult.rows[0];
      const invoice = invoicesResult.rows[0];
      const values = Object.fromEntries(settings.rows.map(row => [row.key, row.value]));
      const checklist = [
        ['Registered business name', values.legal_name], ['Business address', values.business_address], ['Support email', values.support_email], ['Support phone', values.support_phone], ['Customer support hours', values.support_hours], ['Refund processing timeline', values.refund_timeline],
        ['Each service has pricing / quote basis', Number(service.missing_price) === 0 && Number(service.total)>0 ? 'yes' : ''],
        ['Business profile confirmed', values.profile_confirmed === 'true' ? 'yes' : ''], ['Policies reviewed', values.policies_confirmed === 'true' ? 'yes' : ''],
      ];
      const missing = checklist.filter(([, value]) => !String(value || '').trim());
      const gate = process.env.RAZORPAY_KEY_ID ? (process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_') ? 'Live credentials configured' : 'Test credentials configured') : 'Payment credentials not configured';
      const rows = recent.rows.length ? recent.rows.map(row => `<tr><td><b>${esc(row.name)}</b><small>${esc(row.email)}</small></td><td>${esc(row.phone || '—')}</td><td>${esc(row.project_type || 'Website enquiry')}</td><td><span class="status status-${esc(row.status)}">${esc(statusLabel(row.status))}</span></td><td>${fmtDate(row.created_at)}</td><td><a href="/admin/enquiries?q=${encodeURIComponent(row.email)}">Open →</a></td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">Enquiries will appear here when a customer uses the contact form.</td></tr>';
      const body = `${notice(req.query.saved ? 'Changes saved.' : '')}<section class="admin-welcome"><div><span class="admin-kicker">TODAY / ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span><h2>Your business,<br><em>at a glance.</em></h2><p>Manage your public website, customer requests and project payments from one place.</p></div><a class="admin-button admin-button-dark" href="/" target="_blank" rel="noreferrer">Preview website ↗</a><div class="welcome-shape">Z</div></section><section class="stat-grid"><article class="stat-card"><span>ALL ENQUIRIES</span><b>${inq.total}</b><small>${inq.new} new requests</small></article><article class="stat-card"><span>ACTIVE SERVICES</span><b>${service.total}</b><small>Managed from Services</small></article><article class="stat-card"><span>PUBLISHED WORK</span><b>${work.total}</b><small>Portfolio items</small></article><article class="stat-card"><span>PAID INVOICES</span><b>${money(invoice.paid)}</b><small>${invoice.total} invoices created</small></article></section><section class="admin-grid"><article class="panel readiness-panel"><div class="panel-heading"><div><span class="admin-kicker">BEFORE YOU SHARE THE WEBSITE</span><h2>Business profile checklist</h2></div><span class="readiness-pill ${missing.length ? 'needs-work' : 'ready'}">${missing.length ? `${missing.length} items to review` : 'Profile complete'}</span></div><p>Razorpay reviews your real business activity and public customer information. Confirm every item reflects how you actually operate.</p><ul class="checklist">${checklist.map(([label, value]) => `<li class="${value ? 'done' : 'todo'}"><i>${value ? '✓' : '!'}</i><span>${esc(label)}</span><b>${value ? 'Added' : 'Needed'}</b></li>`).join('')}</ul><a class="panel-link" href="/admin/settings">Complete business profile →</a><a class="panel-link" href="/admin/policies">Review customer policies →</a><div class="gateway-state"><span class="gateway-led ${process.env.RAZORPAY_KEY_ID ? 'configured' : ''}"></span><span>Razorpay integration</span><b>${esc(gate)}</b></div></article><article class="panel"><div class="panel-heading"><div><span class="admin-kicker">PAYMENT OPERATIONS</span><h2>Payments after approval</h2></div></div><p>Create project invoices and share a Razorpay-hosted payment link after a customer accepts a written quotation. Credentials are read from protected Railway variables and never shown here.</p><a class="admin-button admin-button-primary" href="/admin/invoices">Manage invoices →</a><div class="mini-note">This integration does not make the merchant account live. Razorpay must approve and enable the account first.</div></article></section><section class="panel recent-panel"><div class="panel-heading"><div><span class="admin-kicker">YOUR LATEST ACTIVITY</span><h2>Recent enquiries</h2></div><a class="panel-link" href="/admin/enquiries">View all enquiries →</a></div><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Project type</th><th>Status</th><th>Received</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
      res.send(shell('Overview', '/', body, req.adminSession.csrf));
    } catch (error) { next(error); }
  });

  router.get('/admin/enquiries', async (req, res, next) => {
    try {
      const status = statuses.includes(req.query.status) ? req.query.status : '';
      const search = String(req.query.q || '').trim().slice(0, 120);
      const { rows } = await db.query(`SELECT * FROM enquiries WHERE ($1='' OR status=$1) AND ($2='' OR name ILIKE '%'||$2||'%' OR email ILIKE '%'||$2||'%' OR message ILIKE '%'||$2||'%') ORDER BY created_at DESC LIMIT 200`, [status, search]);
      const cards = rows.map(row => `<article class="enquiry-card"><div class="enquiry-head"><div><span class="admin-kicker">ENQUIRY #${row.id} · ${fmtDate(row.created_at)}</span><h2>${esc(row.name)}</h2><a href="mailto:${esc(row.email)}">${esc(row.email)}</a>${row.phone ? `<span class="enquiry-phone"> · ${esc(row.phone)}</span>` : ''}</div><span class="status status-${esc(row.status)}">${esc(statusLabel(row.status))}</span></div><div class="enquiry-meta"><span><small>PROJECT TYPE</small>${esc(row.project_type || 'Not specified')}</span><span><small>BUDGET RANGE</small>${esc(row.budget_range || 'Not specified')}</span></div><p class="enquiry-message">${esc(row.message)}</p><form class="inline-edit" method="post" action="/admin/enquiries/${row.id}"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${select('status', 'Status', row.status, statuses.map(x => [x, statusLabel(x)]))}${area('admin_note', 'Private notes', row.admin_note || '', 2)}<button class="admin-button admin-button-primary">Save enquiry</button></form></article>`).join('') || '<div class="empty-state"><b>No matching enquiries yet.</b><p>New customer requests will appear here.</p></div>';
      const body = `${notice(req.query.saved ? 'Enquiry updated.' : '')}<section class="panel filter-panel"><form method="get" class="filter-form"><input name="q" placeholder="Search name, email or message" value="${esc(search)}">${select('status', 'Status', status, [['','All statuses'],...statuses.map(x=>[x,statusLabel(x)])])}<button class="admin-button admin-button-dark">Filter</button><a href="/admin/enquiries">Reset</a></form></section><div class="enquiry-list">${cards}</div>`;
      res.send(shell('Enquiries', '/enquiries', body, req.adminSession.csrf));
    } catch (error) { next(error); }
  });
  router.post('/admin/enquiries/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    const status = statuses.includes(req.body.status) ? req.body.status : 'new';
    const note = String(req.body.admin_note || '').slice(0, 4000);
    try { await db.query('UPDATE enquiries SET status=$1, admin_note=$2 WHERE id=$3', [status, note, id]); res.redirect(303, '/admin/enquiries?saved=1'); } catch (error) { next(error); }
  });

  router.get('/admin/services', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT * FROM services ORDER BY position,id');
      const items = rows.map(row => `<article class="manage-card"><form method="post" action="/admin/services/${row.id}" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><div class="manage-card-head"><span class="admin-kicker">SERVICE #${row.id}</span>${select('active','Website display',row.active ? 'true':'false',[['true','Published'],['false','Hidden']])}</div>${field('name','Service title',row.name)}${area('summary','Description',row.summary,3)}<div class="form-row">${field('price_label','Price / quote basis',row.price_label || '','text','Example: fixed price after quote, hourly rate, or starting price.')}${field('delivery_note','Typical delivery',row.delivery_note || '')}</div><button class="admin-button admin-button-primary">Save service</button></form></article>`).join('');
      const body = `${notice(req.query.saved ? 'Service saved.' : '')}<div class="admin-section-lead"><p>Publish only services your business currently offers. Keep pricing or the quotation basis accurate and visible.</p></div><div class="manage-grid">${items}</div><article class="panel add-panel"><h2>Add a service</h2><form method="post" action="/admin/services" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('name','Service title')}${area('summary','Description','',3)}<div class="form-row">${field('price_label','Price / quote basis','')}${field('delivery_note','Typical delivery','')}</div><button class="admin-button admin-button-dark">Add service</button></form></article>`;
      res.send(shell('Services', '/services', body, req.adminSession.csrf));
    } catch (error) { next(error); }
  });
  router.post('/admin/services', async (req, res, next) => {
    const { name, summary, price_label, delivery_note } = req.body;
    if (!String(name || '').trim() || !String(summary || '').trim()) return res.status(400).send('Service title and description are required.');
    try { await db.query('INSERT INTO services(name,summary,price_label,delivery_note,active) VALUES($1,$2,$3,$4,true)', [String(name).trim().slice(0,120), String(summary).trim().slice(0,800), String(price_label||'').trim().slice(0,180), String(delivery_note||'').trim().slice(0,180)]); res.redirect(303, '/admin/services?saved=1'); } catch (error) { next(error); }
  });
  router.post('/admin/services/:id', async (req, res, next) => {
    try { await db.query('UPDATE services SET name=$1,summary=$2,price_label=$3,delivery_note=$4,active=$5,updated_at=now() WHERE id=$6', [String(req.body.name||'').trim().slice(0,120), String(req.body.summary||'').trim().slice(0,800), String(req.body.price_label||'').trim().slice(0,180), String(req.body.delivery_note||'').trim().slice(0,180), req.body.active==='true', Number(req.params.id)]); res.redirect(303, '/admin/services?saved=1'); } catch (error) { next(error); }
  });

  router.get('/admin/portfolio', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT * FROM portfolio ORDER BY position,id DESC');
      const items = rows.map(row => `<article class="manage-card"><form method="post" action="/admin/portfolio/${row.id}" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><div class="manage-card-head"><span class="admin-kicker">PORTFOLIO ITEM #${row.id}</span>${select('published','Website display',row.published?'true':'false',[['true','Published'],['false','Hidden']])}</div>${field('title','Project title',row.title)}<div class="form-row">${field('category','Category',row.category)}${field('client_name','Client name (optional)',row.client_name||'')}</div>${area('summary','What was delivered',row.summary,3)}${field('image_url','Image URL',row.image_url||'','url','Optional: public HTTPS image URL.')}${field('project_url','Project link',row.project_url||'','url','Optional: public HTTPS project URL.')}${select('is_concept','Project type',row.is_concept?'concept':'client',[['client','Completed client work'],['concept','Concept / demonstration']])}<button class="admin-button admin-button-primary">Save portfolio item</button></form></article>`).join('');
      const body = `${notice(req.query.saved?'Portfolio item saved.':'')}<div class="admin-section-lead"><p>Only publish completed work you can substantiate. If an item is a concept or demo, mark it as such so visitors can tell.</p></div><div class="manage-grid">${items}</div><article class="panel add-panel"><h2>Add portfolio item</h2><form method="post" action="/admin/portfolio" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('title','Project title')}<div class="form-row">${field('category','Category')}${field('client_name','Client name (optional)')}</div>${area('summary','What was delivered','',3)}${field('image_url','Image URL (optional)','','url')}${field('project_url','Project link (optional)','','url')}${select('is_concept','Project type','concept',[['concept','Concept / demonstration'],['client','Completed client work']])}<button class="admin-button admin-button-dark">Add portfolio item</button></form></article>`;
      res.send(shell('Portfolio', '/portfolio', body, req.adminSession.csrf));
    } catch (error) { next(error); }
  });
  router.post('/admin/portfolio', async (req, res, next) => {
    const { title, category, client_name, summary } = req.body;
    const image = safeUrl(req.body.image_url), project = safeUrl(req.body.project_url);
    if (!String(title||'').trim() || !String(summary||'').trim()) return res.status(400).send('Project title and summary are required.');
    try { await db.query('INSERT INTO portfolio(title,category,client_name,summary,image_url,project_url,is_concept,published) VALUES($1,$2,$3,$4,$5,$6,$7,false)', [String(title).trim().slice(0,140), String(category||'').trim().slice(0,100), String(client_name||'').trim().slice(0,140), String(summary).trim().slice(0,1000), image, project, req.body.is_concept!=='client']); res.redirect(303, '/admin/portfolio?saved=1'); } catch (error) { next(error); }
  });
  router.post('/admin/portfolio/:id', async (req, res, next) => {
    try { await db.query('UPDATE portfolio SET title=$1,category=$2,client_name=$3,summary=$4,image_url=$5,project_url=$6,is_concept=$7,published=$8,updated_at=now() WHERE id=$9', [String(req.body.title||'').trim().slice(0,140), String(req.body.category||'').trim().slice(0,100), String(req.body.client_name||'').trim().slice(0,140), String(req.body.summary||'').trim().slice(0,1000), safeUrl(req.body.image_url), safeUrl(req.body.project_url), req.body.is_concept!=='client', req.body.published==='true', Number(req.params.id)]); res.redirect(303, '/admin/portfolio?saved=1'); } catch (error) { next(error); }
  });

  router.get('/admin/settings', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT key,value FROM site_settings'); const s = Object.fromEntries(rows.map(row=>[row.key,row.value]));
      const body = `${notice(req.query.saved?'Business profile saved.':'')}<section class="panel settings-panel"><div class="panel-heading"><div><span class="admin-kicker">PUBLIC BUSINESS INFORMATION</span><h2>Business profile</h2></div></div><p>Use the exact details associated with your Razorpay account. Information shown publicly must match your actual business registration and customer support channels.</p><form method="post" action="/admin/settings" class="settings-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('legal_name','Registered business / legal name',s.legal_name||'','text','Match the legal name on your onboarding documents.')}${field('display_name','Public brand name',s.display_name||'ZuTech')}${area('business_address','Registered / operating address',s.business_address||'',3,'Enter the real address customers can use to identify your business.') }<div class="form-row">${field('support_email','Customer support email',s.support_email||'','email')}${field('support_phone','Customer support phone',s.support_phone||'','tel')}</div>${field('support_hours','Support hours and time zone',s.support_hours||'') }<div class="form-row">${field('gstin','GSTIN (if applicable)',s.gstin||'')}${field('website_url','Public website URL',s.website_url||'','url')}</div>${field('refund_timeline','Refund initiation timeline',s.refund_timeline||'','text','State the timeframe your business actually follows after approving a refund request.')}${select('profile_confirmed','I verified these business details',s.profile_confirmed||'false',[['false','Not yet verified'],['true','Verified against my business records']])}<button class="admin-button admin-button-primary">Save business profile</button></form></section><section class="panel gateway-panel"><div class="panel-heading"><div><span class="admin-kicker">PAYMENT GATEWAY</span><h2>Razorpay connection</h2></div><span class="readiness-pill ${process.env.RAZORPAY_KEY_ID?'ready':'needs-work'}">${process.env.RAZORPAY_KEY_ID?(process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')?'Live keys detected':'Test keys detected'):'Not configured'}</span></div><p>Keep all secrets in Railway service variables. Never paste API secrets into website content, GitHub or this form.</p><div class="secret-list"><span>RAZORPAY_KEY_ID <b>${process.env.RAZORPAY_KEY_ID?'Configured':'Missing'}</b></span><span>RAZORPAY_KEY_SECRET <b>${process.env.RAZORPAY_KEY_SECRET?'Configured':'Missing'}</b></span><span>RAZORPAY_WEBHOOK_SECRET <b>${process.env.RAZORPAY_WEBHOOK_SECRET?'Configured':'Missing'}</b></span><span>PUBLIC_BASE_URL <b>${process.env.PUBLIC_BASE_URL?'Configured':'Missing'}</b></span></div><code class="webhook-url">${esc(process.env.PUBLIC_BASE_URL||'Set PUBLIC_BASE_URL first')}/webhooks/razorpay</code></section>`;
      res.send(shell('Business profile', '/settings', body, req.adminSession.csrf));
    } catch (error) { next(error); }
  });
  router.post('/admin/settings', async (req, res, next) => {
    const allowed = ['legal_name','display_name','business_address','support_email','support_phone','support_hours','gstin','website_url','refund_timeline','profile_confirmed'];
    try {
      for (const key of allowed) {
        let value = String(req.body[key] || '').trim().slice(0, key === 'business_address' ? 1000 : 500);
        if (key === 'website_url') value = safeUrl(value);
        if (key === 'support_email' && value && !/^\S+@\S+\.\S+$/.test(value)) return res.status(400).send('Enter a valid support email address.');
        if (key === 'profile_confirmed' && value !== 'true') value = 'false';
        await db.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()', [key,value]);
      }
      res.redirect(303, '/admin/settings?saved=1');
    } catch (error) { next(error); }
  });

  router.get('/admin/policies', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT key,value FROM site_settings WHERE key LIKE \'policy_%\' OR key IN (\'policies_confirmed\')'); const p = Object.fromEntries(rows.map(row=>[row.key,row.value]));
      const body = `${notice(req.query.saved?'Policies saved.':'')}<section class="policy-alert"><b>Before you publish:</b> these pages must describe what your business really does and what customers can expect. Razorpay terms require clear terms and refund/cancellation policies, including timelines. The checklist remains incomplete until you verify these terms.</section><form class="policy-edit-grid" method="post" action="/admin/policies"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${area('policy_about','About the business',p.policy_about||'',5)}${area('policy_terms','Terms & conditions',p.policy_terms||'',7)}${area('policy_privacy','Privacy policy',p.policy_privacy||'',7)}${area('policy_refund','Refund & cancellation policy',p.policy_refund||'',7)}${area('policy_delivery','Service delivery / timelines',p.policy_delivery||'',6)}${area('policy_contact','Customer support / grievance contact',p.policy_contact||'',5,'The public Contact page also displays profile contact fields.')}${select('policies_confirmed','I reviewed these policies for accuracy',p.policies_confirmed||'false',[['false','Not yet verified'],['true','Verified and accurate']])}<button class="admin-button admin-button-primary">Save all policies</button></form>`;
      res.send(shell('Customer policies', '/policies', body, req.adminSession.csrf));
    } catch (error) { next(error); }
  });
  router.post('/admin/policies', async (req, res, next) => {
    const allowed = ['policy_about','policy_terms','policy_privacy','policy_refund','policy_delivery','policy_contact','policies_confirmed'];
    try { for (const key of allowed) { let value=String(req.body[key]||'').trim().slice(0,8000); if(key==='policies_confirmed'&&value!=='true') value='false'; await db.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',[key,value]); } res.redirect(303,'/admin/policies?saved=1'); } catch(error){next(error);}
  });

  router.get('/admin/invoices', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 100');
      const invoices = rows.map(row=>`<tr><td><b>${esc(row.invoice_no)}</b><small>${esc(row.client_name)} · ${esc(row.client_email)}</small></td><td>${esc(row.description)}</td><td>${money(row.amount_paise)}${Number(row.amount_paid_paise)>0&&Number(row.amount_paid_paise)<Number(row.amount_paise)?`<small>Paid ${money(row.amount_paid_paise)}</small>`:''}</td><td><span class="status status-${esc(row.status)}">${esc(row.status.replace('_',' '))}</span></td><td>${fmtDate(row.created_at)}</td><td>${row.payment_url?`<a target="_blank" rel="noreferrer" href="${esc(row.payment_url)}">Open pay link</a><button class="copy-link" type="button" data-copy="${esc(row.payment_url)}">Copy</button>`:'—'}${row.status==='created'?`<form class="invoice-action" method="post" action="/admin/invoices/${row.id}/cancel" onsubmit="return confirm('Cancel this payment link with Razorpay?')"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><button>Cancel link</button></form>`:''}${['paid','partially_refunded'].includes(row.status)&&row.razorpay_payment_id?`<form class="invoice-action refund-action" method="post" action="/admin/invoices/${row.id}/refund" onsubmit="return confirm('Submit this refund to Razorpay?')"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><input name="amount_rupees" type="number" min="1" step="0.01" placeholder="Full refund or amount"><button>Issue refund</button></form>`:''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-cell">No invoices yet.</td></tr>';
      const gateway = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
      const body = `${notice(req.query.created?'Invoice and payment link created.':'')}${req.query.refunded?notice('Refund request sent to Razorpay. Check the invoice status for updates.'):''}${req.query.cancelled?notice('Payment link cancelled.'):''}${req.query.error?notice(req.query.error,'danger'):''}<div class="admin-section-lead"><p>Create an invoice only for a real, agreed ZuTech service. A payment link is generated only when Razorpay keys are configured. The link is hosted by Razorpay; card details never pass through this site.</p></div><section class="invoice-layout"><article class="panel"><span class="admin-kicker">NEW PROJECT PAYMENT</span><h2>Create invoice</h2><form method="post" action="/admin/invoices" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('client_name','Customer name','','text')}${field('client_email','Customer email','','email')}${field('client_phone','Customer phone (optional)','','tel')}${area('description','Agreed service / milestone','',3)}${field('amount_rupees','Amount (INR)','','number','Enter the amount from the accepted written quotation.')}${field('expires_days','Payment link validity (days)','15','number')}<label class="admin-field consent-line"><span><input type="checkbox" name="accepted_quote" value="yes" required> I confirm the customer accepted this service and amount in writing.</span></label><button class="admin-button admin-button-primary" ${gateway?'':'disabled'}>${gateway?'Create invoice & payment link':'Configure Razorpay keys first'}</button></form>${!gateway?'<p class="mini-note">Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as protected Railway variables after Razorpay activates your account.</p>':''}</article><article class="panel"><span class="admin-kicker">GATEWAY STATUS</span><h2>${gateway?(process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')?'Razorpay Live':'Razorpay Test'):'Not connected'}</h2><p>${gateway?'Invoice links use the server-side API secret. Payment state is updated only by a verified Razorpay webhook.':'You can prepare the website and admin profile before adding gateway credentials.'}</p><div class="secret-list"><span>API key <b>${process.env.RAZORPAY_KEY_ID?'Configured':'Missing'}</b></span><span>Webhook secret <b>${process.env.RAZORPAY_WEBHOOK_SECRET?'Configured':'Missing'}</b></span></div><code class="webhook-url">${esc(process.env.PUBLIC_BASE_URL||'https://your-domain.example')}/webhooks/razorpay</code></article></section><section class="panel recent-panel"><div class="panel-heading"><div><span class="admin-kicker">BILLING RECORDS</span><h2>Invoices</h2></div></div><div class="table-wrap"><table><thead><tr><th>Invoice / customer</th><th>Service</th><th>Amount</th><th>Status</th><th>Created</th><th>Payment link / action</th></tr></thead><tbody>${invoices}</tbody></table></div></section><script>document.querySelectorAll('.copy-link').forEach(b=>b.onclick=()=>navigator.clipboard.writeText(b.dataset.copy).then(()=>{b.textContent='Copied'}));</script>`;
      res.send(shell('Invoices & payments','/invoices',body,req.adminSession.csrf));
    } catch(error){next(error);}
  });
  router.post('/admin/invoices', async (req, res, next) => {
    const name=String(req.body.client_name||'').trim().slice(0,120), email=String(req.body.client_email||'').trim().slice(0,200), phone=String(req.body.client_phone||'').trim().slice(0,24), description=String(req.body.description||'').trim().slice(0,500), amount=Number(req.body.amount_rupees), days=Number(req.body.expires_days||15);
    if(req.body.accepted_quote!=='yes'||!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!description||!Number.isFinite(amount)||amount<1||amount>10000000||Math.round(amount*100)!==amount*100||!Number.isInteger(days)||days<1||days>180) return res.redirect(303,'/admin/invoices?error='+encodeURIComponent('Confirm the accepted written quotation and check customer details, amount and link expiry.'));
    const key=process.env.RAZORPAY_KEY_ID, secret=process.env.RAZORPAY_KEY_SECRET;
    if(!key||!secret) return res.redirect(303,'/admin/invoices?error='+encodeURIComponent('Razorpay API credentials are not configured.'));
    let invoiceId = null;
    try {
      const insert=await db.query("INSERT INTO invoices(invoice_no,client_name,client_email,client_phone,description,amount_paise,status) VALUES('PENDING',$1,$2,$3,$4,$5,'creating') RETURNING id",[name,email,phone,description,Math.round(amount*100)]);
      const id=insert.rows[0].id; invoiceId=id;
      const invoiceNo=`ZT-${new Date().toISOString().slice(0,7).replace('-','')}-${String(id).padStart(5,'0')}`;
      const base=(process.env.PUBLIC_BASE_URL||'').replace(/\/$/,'');
      const expireBy=Math.floor(Date.now()/1000)+days*86400;
      const response=await fetch('https://api.razorpay.com/v1/payment_links',{method:'POST',headers:{'Authorization':`Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,'Content-Type':'application/json'},body:JSON.stringify({amount:Math.round(amount*100),currency:'INR',description,reference_id:invoiceNo,customer:{name,email,...(phone?{contact:phone}:{})},notify:{sms:false,email:false},reminder_enable:false,expire_by:expireBy,notes:{invoice_no:invoiceNo},...(base?{callback_url:`${base}/payments/complete`,callback_method:'get'}:{})})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.description||'Razorpay could not create the payment link.');
      await db.query("UPDATE invoices SET invoice_no=$1,status='created',razorpay_link_id=$2,payment_url=$3,expires_at=to_timestamp($4) WHERE id=$5",[invoiceNo,data.id,data.short_url,expireBy,id]);
      res.redirect(303,'/admin/invoices?created=1');
    } catch(error){
      console.error('Invoice/payment link creation failed:',error.message);
      if(invoiceId) await db.query("UPDATE invoices SET status='failed',updated_at=now() WHERE id=$1",[invoiceId]).catch(()=>{});
      res.redirect(303,'/admin/invoices?error='+encodeURIComponent(error.message.slice(0,180)));
    }
  });

  router.post('/admin/invoices/:id/cancel', async (req,res,next) => {
    try {
      const id=Number(req.params.id);
      const {rows}=await db.query('SELECT id,status,razorpay_link_id FROM invoices WHERE id=$1',[id]);
      const invoice=rows[0];
      if(!invoice||invoice.status!=='created'||!invoice.razorpay_link_id) return res.redirect(303,'/admin/invoices?error='+encodeURIComponent('Only an unpaid, active payment link can be cancelled.'));
      const response=await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(invoice.razorpay_link_id)}/cancel`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,'Content-Type':'application/json'},body:'{}'});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.description||'Razorpay could not cancel the payment link.');
      await db.query("UPDATE invoices SET status='cancelled',updated_at=now() WHERE id=$1",[id]);
      res.redirect(303,'/admin/invoices?cancelled=1');
    }catch(error){res.redirect(303,'/admin/invoices?error='+encodeURIComponent(error.message.slice(0,160)));}
  });
  router.post('/admin/invoices/:id/refund', async (req,res,next) => {
    try {
      const id=Number(req.params.id);
      const {rows}=await db.query('SELECT * FROM invoices WHERE id=$1',[id]);
      const invoice=rows[0];
      if(!invoice||!['paid','partially_refunded'].includes(invoice.status)||!invoice.razorpay_payment_id) return res.redirect(303,'/admin/invoices?error='+encodeURIComponent('Refund requires a confirmed payment with a Razorpay payment ID.'));
      const existing=await db.query("SELECT coalesce(sum(amount_paise),0)::bigint AS amount FROM invoice_refunds WHERE invoice_id=$1 AND status<>'failed'",[id]);
      const originalPaid=Number(invoice.amount_paid_paise||invoice.amount_paise);
      const remaining=originalPaid-Number(existing.rows[0].amount||0);
      const raw=String(req.body.amount_rupees||'').trim();
      const refundAmount=raw?Math.round(Number(raw)*100):remaining;
      if(!Number.isSafeInteger(refundAmount)||refundAmount<100||refundAmount>remaining) return res.redirect(303,'/admin/invoices?error='+encodeURIComponent(`Refund must be between ₹1 and ${money(remaining)}.`));
      const receipt=`${invoice.invoice_no}-${Date.now().toString(36)}`.slice(0,40);
      const response=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(invoice.razorpay_payment_id)}/refund`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,'Content-Type':'application/json'},body:JSON.stringify({amount:refundAmount,receipt,notes:{invoice_no:invoice.invoice_no}})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.description||'Razorpay could not create the refund.');
      await db.query('INSERT INTO invoice_refunds(invoice_id,refund_id,amount_paise,status,receipt) VALUES($1,$2,$3,$4,$5) ON CONFLICT(refund_id) DO NOTHING',[id,data.id,refundAmount,data.status||'pending',receipt]);
      const totalRefunds=Number(existing.rows[0].amount||0)+refundAmount;
      const state=data.status==='processed'?(totalRefunds>=originalPaid?'refunded':'partially_refunded'):'refund_pending';
      await db.query('UPDATE invoices SET status=$1,updated_at=now() WHERE id=$2',[state,id]);
      res.redirect(303,'/admin/invoices?refunded=1');
    }catch(error){res.redirect(303,'/admin/invoices?error='+encodeURIComponent(error.message.slice(0,160)));}
  });
  router.use((error, req, res, next) => {
    console.error('Admin request failed:', error.message);
    if (res.headersSent) return next(error);
    res.status(500).send('Admin request could not be completed. Please refresh and try again.');
  });
  return router;
};
