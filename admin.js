const crypto = require('crypto');

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeUrl = value => /^https?:\/\//i.test(String(value || '')) ? String(value).trim() : '';
const statuses = ['new', 'contacted', 'reviewing', 'quoted', 'in_progress', 'complete', 'closed'];
const statusLabel = value => ({ new: 'New', contacted: 'Contacted', reviewing: 'Reviewing', quoted: 'Quoted', in_progress: 'In progress', complete: 'Complete', closed: 'Closed' }[value] || value);

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
  const nav = [['/', 'Overview', '◫'], ['/enquiries', 'Enquiries', '✉'], ['/services', 'Services & estimates', '◇'], ['/portfolio', 'Case studies', '▧'], ['/testimonials', 'Testimonials', '☆'], ['/insights', 'Insights', '✎'], ['/consultations', 'Consultations', '◷'], ['/proposals', 'Quotes & proposals', '▤'], ['/reports', 'Reports & backup', '▥'], ['/settings', 'Business profile', '⚙'], ['/policies', 'Policies', '≡'], ['/invoices', 'Invoices & payments', '₹']];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} | ZuTech Admin</title><link rel="stylesheet" href="/admin.css"></head><body class="admin-page"><aside class="admin-sidebar"><a class="admin-brand" href="/">Z<span>U</span>TECH<small>STUDIO CONSOLE</small></a><div class="sidebar-label">WORKSPACE</div><nav>${nav.map(([href, label, symbol]) => `<a class="${active === href ? 'active' : ''}" href="/admin${href === '/' ? '' : href}"><i>${symbol}</i>${label}</a>`).join('')}</nav><div class="sidebar-bottom"><a class="sidebar-site" href="/" target="_blank" rel="noreferrer">View website ↗</a><form method="post" action="/admin/logout"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="logout-button">Sign out</button></form><small>Private workspace · ZuTech</small></div></aside><main class="admin-main"><header class="admin-topbar"><div><span class="admin-kicker">WEBSITE MANAGEMENT</span><h1>${esc(title)}</h1></div><div class="admin-user"><span class="user-avatar">Z</span><span><b>Administrator</b><small>Website owner</small></span></div></header>${body}<footer class="admin-footer">ZuTech Studio Console <span>Website content and customer data are private.</span></footer></main></body></html>`;
}

function notice(message, kind = 'success') { return message ? `<div class="notice notice-${kind}">${esc(message)}</div>` : ''; }
function fmtDate(value) { return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—'; }
function money(paise) { return `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
async function audit(db,req,action,entity='',entityId='',details='') {
  if(!db)return;
  await db.query('INSERT INTO admin_audit_logs(admin_name,action,entity,entity_id,details) VALUES($1,$2,$3,$4,$5)',[process.env.ADMIN_USERNAME||'admin',String(action).slice(0,80),String(entity).slice(0,80),String(entityId).slice(0,80),String(details).slice(0,500)]);
}
const slugify = value => String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100) || `article-${Date.now()}`;

module.exports = function createAdminRouter({ express, db, sendBusinessEmail = async () => false }) {
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
    try { await db.query('UPDATE enquiries SET status=$1, admin_note=$2 WHERE id=$3', [status, note, id]); await audit(db,req,'updated','enquiry',id,status); res.redirect(303, '/admin/enquiries?saved=1'); } catch (error) { next(error); }
  });

  router.get('/admin/services', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT * FROM services ORDER BY position,id');
      const items = rows.map(row => `<article class="manage-card"><form method="post" action="/admin/services/${row.id}" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><div class="manage-card-head"><span class="admin-kicker">SERVICE #${row.id}</span>${select('active','Website display',row.active ? 'true':'false',[['true','Published'],['false','Hidden']])}</div>${field('name','Service title',row.name)}${area('summary','Description',row.summary,3)}<div class="form-row">${field('price_label','Price / quote basis',row.price_label || '','text','Shown publicly as your price explanation.')}${field('delivery_note','Typical delivery',row.delivery_note || '')}</div><div class="form-row">${field('price_min_rupees','Estimate minimum (₹)',row.price_min_paise?Number(row.price_min_paise)/100:'','number','Optional: used by the public estimate planner.')}${field('price_max_rupees','Estimate maximum (₹)',row.price_max_paise?Number(row.price_max_paise)/100:'','number','Enter actual indicative bounds or leave both blank.')}</div><button class="admin-button admin-button-primary">Save service</button></form></article>`).join('');
      const body = `${notice(req.query.saved ? 'Service saved.' : '')}<div class="admin-section-lead"><p>Only publish real services and accurate pricing. Enter both estimate bounds to activate the public indicative quote range; leave both blank for a custom written quotation.</p></div><div class="manage-grid">${items}</div><article class="panel add-panel"><h2>Add a service</h2><form method="post" action="/admin/services" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('name','Service title')}${area('summary','Description','',3)}<div class="form-row">${field('price_label','Price / quote basis','')}${field('delivery_note','Typical delivery','')}</div><div class="form-row">${field('price_min_rupees','Estimate minimum (₹)','','number')}${field('price_max_rupees','Estimate maximum (₹)','','number')}</div><button class="admin-button admin-button-dark">Add service</button></form></article>`;
      res.send(shell('Services', '/services', body, req.adminSession.csrf));
    } catch (error) { next(error); }
  });
  router.post('/admin/services', async (req, res, next) => {
    const { name, summary, price_label, delivery_note } = req.body;
    if (!String(name || '').trim() || !String(summary || '').trim()) return res.status(400).send('Service title and description are required.');
    const min=Number(req.body.price_min_rupees||0),max=Number(req.body.price_max_rupees||0);
    if((min||max)&&(min<0||max<min||max<=0||max>10000000))return res.status(400).send('Estimate must have a valid minimum and maximum price.');
    try { const result=await db.query('INSERT INTO services(name,summary,price_label,delivery_note,price_min_paise,price_max_paise,active) VALUES($1,$2,$3,$4,$5,$6,true) RETURNING id', [String(name).trim().slice(0,120), String(summary).trim().slice(0,800), String(price_label||'').trim().slice(0,180), String(delivery_note||'').trim().slice(0,180),Math.round(min*100),Math.round(max*100)]);await audit(db,req,'created','service',result.rows[0].id,name); res.redirect(303, '/admin/services?saved=1'); } catch (error) { next(error); }
  });
  router.post('/admin/services/:id', async (req, res, next) => {
    const min=Number(req.body.price_min_rupees||0),max=Number(req.body.price_max_rupees||0);
    if((min||max)&&(min<0||max<min||max<=0||max>10000000))return res.status(400).send('Estimate must have a valid minimum and maximum price.');
    try { await db.query('UPDATE services SET name=$1,summary=$2,price_label=$3,delivery_note=$4,active=$5,price_min_paise=$6,price_max_paise=$7,updated_at=now() WHERE id=$8', [String(req.body.name||'').trim().slice(0,120), String(req.body.summary||'').trim().slice(0,800), String(req.body.price_label||'').trim().slice(0,180), String(req.body.delivery_note||'').trim().slice(0,180), req.body.active==='true',Math.round(min*100),Math.round(max*100), Number(req.params.id)]);await audit(db,req,'updated','service',req.params.id,req.body.name); res.redirect(303, '/admin/services?saved=1'); } catch (error) { next(error); }
  });

  router.get('/admin/portfolio', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT * FROM portfolio ORDER BY position,id DESC');
      const items = rows.map(row => `<article class="manage-card"><form method="post" action="/admin/portfolio/${row.id}" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><div class="manage-card-head"><span class="admin-kicker">PORTFOLIO ITEM #${row.id}</span>${select('published','Website display',row.published?'true':'false',[['true','Published'],['false','Hidden']])}</div>${field('title','Project title',row.title)}<div class="form-row">${field('category','Category',row.category)}${field('client_name','Client name (optional)',row.client_name||'')}</div>${area('summary','Short public summary',row.summary,3)}${area('challenge','Case study: challenge',row.challenge||'',3)}${area('approach','Case study: approach',row.approach||'',3)}${area('outcome','Case study: outcome / deliverables',row.outcome||'',3)}${field('result_metric','Verified result (optional)',row.result_metric||'','text','Only use a result that the client has approved and you can substantiate.')}${field('image_url','Image URL',row.image_url||'','url','Optional: public HTTPS image URL.')}${field('project_url','External project link',row.project_url||'','url','Optional public link.')}${select('is_concept','Project type',row.is_concept?'concept':'client',[['client','Completed client work'],['concept','Concept / demonstration']])}<button class="admin-button admin-button-primary">Save portfolio item</button></form></article>`).join('');
      const body = `${notice(req.query.saved?'Portfolio item saved.':'')}<div class="admin-section-lead"><p>Client case studies appear publicly only when marked Completed client work and Published. Add challenge, approach and outcome from a real project. Concept demos remain clearly labelled.</p></div><div class="manage-grid">${items}</div><article class="panel add-panel"><h2>Add a case study or concept</h2><form method="post" action="/admin/portfolio" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('title','Project title')}<div class="form-row">${field('category','Category')}${field('client_name','Client name (optional)')}</div>${area('summary','Short public summary','',3)}${area('challenge','Case study: challenge','',3)}${area('approach','Case study: approach','',3)}${area('outcome','Case study: outcome / deliverables','',3)}${field('result_metric','Verified result (optional)','','text','Only use a result that the client has approved and you can substantiate.')}${field('image_url','Image URL (optional)','','url')}${field('project_url','External project link (optional)','','url')}${select('is_concept','Project type','concept',[['concept','Concept / demonstration'],['client','Completed client work']])}<button class="admin-button admin-button-dark">Add portfolio item</button></form></article>`;
      res.send(shell('Portfolio', '/portfolio', body, req.adminSession.csrf));
    } catch (error) { next(error); }
  });
  router.post('/admin/portfolio', async (req, res, next) => {
    const { title, category, client_name, summary } = req.body;
    const image = safeUrl(req.body.image_url), project = safeUrl(req.body.project_url);
    if (!String(title||'').trim() || !String(summary||'').trim()) return res.status(400).send('Project title and summary are required.');
    try { const result=await db.query('INSERT INTO portfolio(title,category,client_name,summary,image_url,project_url,is_concept,published,challenge,approach,outcome,result_metric) VALUES($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10,$11) RETURNING id', [String(title).trim().slice(0,140), String(category||'').trim().slice(0,100), String(client_name||'').trim().slice(0,140), String(summary).trim().slice(0,1000), image, project, req.body.is_concept!=='client',String(req.body.challenge||'').slice(0,2500),String(req.body.approach||'').slice(0,2500),String(req.body.outcome||'').slice(0,2500),String(req.body.result_metric||'').slice(0,180)]);await audit(db,req,'created','portfolio',result.rows[0].id,title); res.redirect(303, '/admin/portfolio?saved=1'); } catch (error) { next(error); }
  });
  router.post('/admin/portfolio/:id', async (req, res, next) => {
    try { await db.query('UPDATE portfolio SET title=$1,category=$2,client_name=$3,summary=$4,image_url=$5,project_url=$6,is_concept=$7,published=$8,challenge=$9,approach=$10,outcome=$11,result_metric=$12,updated_at=now() WHERE id=$13', [String(req.body.title||'').trim().slice(0,140), String(req.body.category||'').trim().slice(0,100), String(req.body.client_name||'').trim().slice(0,140), String(req.body.summary||'').trim().slice(0,1000), safeUrl(req.body.image_url), safeUrl(req.body.project_url), req.body.is_concept!=='client', req.body.published==='true',String(req.body.challenge||'').slice(0,2500),String(req.body.approach||'').slice(0,2500),String(req.body.outcome||'').slice(0,2500),String(req.body.result_metric||'').slice(0,180), Number(req.params.id)]);await audit(db,req,'updated','portfolio',req.params.id,req.body.title); res.redirect(303, '/admin/portfolio?saved=1'); } catch (error) { next(error); }
  });

  router.get('/admin/settings', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT key,value FROM site_settings'); const s = Object.fromEntries(rows.map(row=>[row.key,row.value]));
      const body = `${notice(req.query.saved?'Business profile saved.':'')}<p class="mini-note">Email alerts: ${process.env.BREVO_API_KEY&&process.env.EMAIL_FROM?'Configured':'Set BREVO_API_KEY and EMAIL_FROM in Railway service variables to deliver enquiry and booking emails.'}${process.env.NOTIFY_EMAIL?'':' (Optional: set NOTIFY_EMAIL for the admin notification recipient.)'}</p><section class="panel settings-panel"><div class="panel-heading"><div><span class="admin-kicker">PUBLIC BUSINESS INFORMATION</span><h2>Business profile</h2></div></div><p>Use the exact details associated with your Razorpay account. Information shown publicly must match your actual business registration and customer support channels.</p><form method="post" action="/admin/settings" class="settings-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('legal_name','Registered business / legal name',s.legal_name||'','text','Match the legal name on your onboarding documents.')}${field('display_name','Public brand name',s.display_name||'ZuTech')}${area('business_address','Registered / operating address',s.business_address||'',3,'Enter the real address customers can use to identify your business.') }<div class="form-row">${field('support_email','Customer support email',s.support_email||'','email')}${field('support_phone','Customer support phone',s.support_phone||'','tel')}</div>${field('support_hours','Support hours and time zone',s.support_hours||'') }<div class="form-row">${field('gstin','GSTIN (if applicable)',s.gstin||'')}${field('website_url','Public website URL',s.website_url||'','url')}</div>${field('refund_timeline','Refund initiation timeline',s.refund_timeline||'','text','State the timeframe your business actually follows after approving a refund request.')}${select('profile_confirmed','I verified these business details',s.profile_confirmed||'false',[['false','Not yet verified'],['true','Verified against my business records']])}<button class="admin-button admin-button-primary">Save business profile</button></form></section><section class="panel gateway-panel"><div class="panel-heading"><div><span class="admin-kicker">PAYMENT GATEWAY</span><h2>Razorpay connection</h2></div><span class="readiness-pill ${process.env.RAZORPAY_KEY_ID?'ready':'needs-work'}">${process.env.RAZORPAY_KEY_ID?(process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')?'Live keys detected':'Test keys detected'):'Not configured'}</span></div><p>Keep all secrets in Railway service variables. Never paste API secrets into website content, GitHub or this form.</p><div class="secret-list"><span>RAZORPAY_KEY_ID <b>${process.env.RAZORPAY_KEY_ID?'Configured':'Missing'}</b></span><span>RAZORPAY_KEY_SECRET <b>${process.env.RAZORPAY_KEY_SECRET?'Configured':'Missing'}</b></span><span>RAZORPAY_WEBHOOK_SECRET <b>${process.env.RAZORPAY_WEBHOOK_SECRET?'Configured':'Missing'}</b></span><span>PUBLIC_BASE_URL <b>${process.env.PUBLIC_BASE_URL?'Configured':'Missing'}</b></span></div><code class="webhook-url">${esc(process.env.PUBLIC_BASE_URL||'Set PUBLIC_BASE_URL first')}/webhooks/razorpay</code></section>`;
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
      await audit(db,req,'updated','business_profile','settings','Business profile settings changed');
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
    try { for (const key of allowed) { let value=String(req.body[key]||'').trim().slice(0,8000); if(key==='policies_confirmed'&&value!=='true') value='false'; await db.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',[key,value]); }await audit(db,req,'updated','policies','all','Customer policy pages'); res.redirect(303,'/admin/policies?saved=1'); } catch(error){next(error);}
  });

  router.get('/admin/testimonials',async(req,res,next)=>{
    try {
      const {rows}=await db.query('SELECT * FROM testimonials ORDER BY position,id DESC');
      const items=rows.map(row=>`<article class="manage-card"><form class="manage-form" method="post" action="/admin/testimonials/${row.id}"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><div class="manage-card-head"><span class="admin-kicker">REVIEW #${row.id}</span>${select('published','Website display',row.published?'true':'false',[['false','Hidden'],['true','Published']])}</div>${field('customer_name','Customer name',row.customer_name)}<div class="form-row">${field('role','Role / position',row.role||'')}${field('company','Company',row.company||'')}</div>${area('quote','Customer quote',row.quote,4)}${select('rating','Rating',String(row.rating),[['5','5 stars'],['4','4 stars'],['3','3 stars'],['2','2 stars'],['1','1 star']])}<button class="admin-button admin-button-primary">Save review</button></form></article>`).join('');
      const body=`${notice(req.query.saved?'Testimonial saved.':'')}<div class="policy-alert"><b>Publish genuine customer feedback only.</b> Keep consent to publish on record; never add invented testimonials.</div><div class="manage-grid">${items}</div><article class="panel add-panel"><h2>Add a customer review</h2><form class="manage-form" method="post" action="/admin/testimonials"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('customer_name','Customer name')}${field('role','Role / position')}${field('company','Company')}${area('quote','Exact approved customer quote','',4)}${select('rating','Rating','5',[['5','5 stars'],['4','4 stars'],['3','3 stars'],['2','2 stars'],['1','1 star']])}<button class="admin-button admin-button-dark">Save as hidden</button></form></article>`;
      res.send(shell('Testimonials','/testimonials',body,req.adminSession.csrf));
    }catch(error){next(error);}
  });
  router.post('/admin/testimonials',async(req,res,next)=>{
    const name=String(req.body.customer_name||'').trim(),quote=String(req.body.quote||'').trim(),rating=Math.max(1,Math.min(5,Number(req.body.rating)||5));
    if(!name||name.length>120||!quote||quote.length>1200)return res.status(400).send('Customer name and approved quote are required.');
    try{const result=await db.query('INSERT INTO testimonials(customer_name,role,company,quote,rating,published) VALUES($1,$2,$3,$4,$5,false) RETURNING id',[name,String(req.body.role||'').slice(0,120),String(req.body.company||'').slice(0,120),quote,rating]);await audit(db,req,'created','testimonial',result.rows[0].id,name);res.redirect(303,'/admin/testimonials?saved=1');}catch(error){next(error);}
  });
  router.post('/admin/testimonials/:id',async(req,res,next)=>{
    const name=String(req.body.customer_name||'').trim(),quote=String(req.body.quote||'').trim(),rating=Math.max(1,Math.min(5,Number(req.body.rating)||5));
    if(!name||!quote)return res.status(400).send('Customer name and approved quote are required.');
    try{await db.query('UPDATE testimonials SET customer_name=$1,role=$2,company=$3,quote=$4,rating=$5,published=$6,updated_at=now() WHERE id=$7',[name.slice(0,120),String(req.body.role||'').slice(0,120),String(req.body.company||'').slice(0,120),quote.slice(0,1200),rating,req.body.published==='true',Number(req.params.id)]);await audit(db,req,'updated','testimonial',req.params.id,name);res.redirect(303,'/admin/testimonials?saved=1');}catch(error){next(error);}
  });

  router.get('/admin/insights',async(req,res,next)=>{
    try{
      const {rows}=await db.query('SELECT * FROM insights ORDER BY updated_at DESC');
      const items=rows.map(row=>`<article class="manage-card"><form class="manage-form" method="post" action="/admin/insights/${row.id}"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><div class="manage-card-head"><span class="admin-kicker">ARTICLE #${row.id} · ${row.published?'PUBLISHED':'DRAFT'}</span>${select('published','Website display',row.published?'true':'false',[['false','Draft'],['true','Published']])}</div>${field('title','Title',row.title)}${field('slug','URL slug',row.slug)}${area('summary','Short description',row.summary,3)}${area('body','Article body',row.body,8)}${row.published?`<a class="panel-link" href="/insights/${encodeURIComponent(row.slug)}" target="_blank" rel="noreferrer">View published article ↗</a>`:''}<button class="admin-button admin-button-primary">Save article</button></form></article>`).join('');
      const body=`${notice(req.query.saved?'Article saved.':'')}<div class="admin-section-lead"><p>Publish only accurate, useful guidance from your business. Articles help customers understand your work and create search-friendly pages.</p></div><div class="manage-grid">${items}</div><article class="panel add-panel"><h2>Write an insight</h2><form class="manage-form" method="post" action="/admin/insights"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('title','Article title')}${field('slug','URL slug (optional)','','text','Generated from the title if left blank.')}${area('summary','Short description','',3)}${area('body','Article body','',8)}<button class="admin-button admin-button-dark">Save as draft</button></form></article>`;
      res.send(shell('Insights','/insights',body,req.adminSession.csrf));
    }catch(error){next(error);}
  });
  router.post('/admin/insights',async(req,res,next)=>{
    const title=String(req.body.title||'').trim(),summary=String(req.body.summary||'').trim(),body=String(req.body.body||'').trim(),slug=slugify(req.body.slug||title);
    if(!title||!summary||!body)return res.status(400).send('Title, summary and article body are required.');
    try{const result=await db.query("INSERT INTO insights(slug,title,summary,body,published,published_at) VALUES($1,$2,$3,$4,false,NULL) RETURNING id",[slug,title.slice(0,160),summary.slice(0,1000),body.slice(0,16000)]);await audit(db,req,'created','insight',result.rows[0].id,title);res.redirect(303,'/admin/insights?saved=1');}catch(error){if(error.code==='23505')return res.redirect(303,'/admin/insights?error='+encodeURIComponent('That URL slug is already in use.'));next(error);}
  });
  router.post('/admin/insights/:id',async(req,res,next)=>{
    const title=String(req.body.title||'').trim(),summary=String(req.body.summary||'').trim(),body=String(req.body.body||'').trim(),slug=slugify(req.body.slug||title),published=req.body.published==='true';
    if(!title||!summary||!body)return res.status(400).send('Title, summary and article body are required.');
    try{await db.query('UPDATE insights SET slug=$1,title=$2,summary=$3,body=$4,published=$5,published_at=CASE WHEN $5 THEN COALESCE(published_at,now()) ELSE NULL END,updated_at=now() WHERE id=$6',[slug,title.slice(0,160),summary.slice(0,1000),body.slice(0,16000),published,Number(req.params.id)]);await audit(db,req,'updated','insight',req.params.id,title);res.redirect(303,'/admin/insights?saved=1');}catch(error){if(error.code==='23505')return res.redirect(303,'/admin/insights?error='+encodeURIComponent('That URL slug is already in use.'));next(error);}
  });

  router.get('/admin/consultations',async(req,res,next)=>{
    try{
      const [slotResult,bookingResult]=await Promise.all([
        db.query('SELECT s.*,b.name,b.email,b.phone,b.summary,b.status AS booking_status FROM consultation_slots s LEFT JOIN consultation_bookings b ON b.slot_id=s.id WHERE s.starts_at>now()-interval \'14 days\' ORDER BY s.starts_at LIMIT 100'),
        db.query('SELECT b.*,s.starts_at,s.ends_at FROM consultation_bookings b JOIN consultation_slots s ON s.id=b.slot_id ORDER BY s.starts_at DESC LIMIT 100')
      ]);
      const slots=slotResult.rows.map(s=>`<tr><td>${fmtDate(s.starts_at)}</td><td>${s.ends_at?fmtDate(s.ends_at):'—'}</td><td>${s.name?`<b>${esc(s.name)}</b><small>${esc(s.email)}${s.phone?' · '+esc(s.phone):''}</small><small>${esc(s.summary)}</small>`:'—'}</td><td><span class="status status-${esc(s.status)}">${esc(s.status)}</span></td><td>${s.status==='open'?`<form method="post" action="/admin/consultations/slots/${s.id}/close"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><button class="invoice-action-button">Close slot</button></form>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-cell">No consultation times yet.</td></tr>';
      const bookings=bookingResult.rows.map(b=>`<article class="enquiry-card"><div class="enquiry-head"><div><span class="admin-kicker">BOOKING #${b.id} · ${fmtDate(b.starts_at)}</span><h2>${esc(b.name)}</h2><a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.phone?`<span> · ${esc(b.phone)}</span>`:''}</div><span class="status status-${esc(b.status)}">${esc(b.status)}</span></div><p class="enquiry-message">${esc(b.summary)}</p><form class="inline-edit" method="post" action="/admin/consultations/bookings/${b.id}"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${select('status','Booking status',b.status,[['booked','Booked'],['completed','Completed'],['cancelled','Cancelled']])}<button class="admin-button admin-button-primary">Update booking</button></form></article>`).join('')||'<div class="empty-state">No consultation requests yet.</div>';
      const body=`${notice(req.query.saved?'Consultation schedule updated.':'')}${req.query.error?notice(req.query.error,'danger'):''}<section class="panel"><div class="panel-heading"><div><span class="admin-kicker">AVAILABLE TIME SLOTS</span><h2>Open the calendar</h2></div></div><p>Enter local India Standard Time. Customers can book open slots once; a slot closes automatically after one booking.</p><form class="manage-form" method="post" action="/admin/consultations/slots"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><div class="form-row">${field('starts_at','Start (IST)','','datetime-local')}${field('ends_at','End (IST)','','datetime-local')}</div><button class="admin-button admin-button-primary">Add available time</button></form></section><section class="panel recent-panel"><div class="panel-heading"><div><span class="admin-kicker">SCHEDULE</span><h2>Slots and reservations</h2></div></div><div class="table-wrap"><table><thead><tr><th>Start (IST)</th><th>End (IST)</th><th>Customer</th><th>Status</th><th></th></tr></thead><tbody>${slots}</tbody></table></div></section><section class="enquiry-list">${bookings}</section>`;
      res.send(shell('Consultations','/consultations',body,req.adminSession.csrf));
    }catch(error){next(error);}
  });
  router.post('/admin/consultations/slots',async(req,res,next)=>{
    const starts=new Date(`${req.body.starts_at||''}+05:30`),ends=new Date(`${req.body.ends_at||''}+05:30`);
    if(!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime())||starts<=new Date()||ends<=starts||ends-starts>2*60*60*1000)return res.redirect(303,'/admin/consultations?error='+encodeURIComponent('Choose a future slot up to two hours long. Times use IST.'));
    try{const result=await db.query('INSERT INTO consultation_slots(starts_at,ends_at) VALUES($1,$2) RETURNING id',[starts,ends]);await audit(db,req,'created','consultation_slot',result.rows[0].id,starts.toISOString());res.redirect(303,'/admin/consultations?saved=1');}catch(error){if(error.code==='23505')return res.redirect(303,'/admin/consultations?error='+encodeURIComponent('A slot already exists at that start time.'));next(error);}
  });
  router.post('/admin/consultations/slots/:id/close',async(req,res,next)=>{
    try{await db.query("UPDATE consultation_slots SET status='closed' WHERE id=$1 AND status='open'",[Number(req.params.id)]);await audit(db,req,'closed','consultation_slot',req.params.id);res.redirect(303,'/admin/consultations?saved=1');}catch(error){next(error);}
  });
  router.post('/admin/consultations/bookings/:id',async(req,res,next)=>{
    const status=['booked','completed','cancelled'].includes(req.body.status)?req.body.status:'booked';
    try{await db.query('UPDATE consultation_bookings SET status=$1 WHERE id=$2',[status,Number(req.params.id)]);await audit(db,req,'updated','consultation_booking',req.params.id,status);res.redirect(303,'/admin/consultations?saved=1');}catch(error){next(error);}
  });

  router.get('/admin/proposals',async(req,res,next)=>{
    try{
      const {rows}=await db.query('SELECT * FROM proposals ORDER BY created_at DESC LIMIT 100');
      const items=rows.map(p=>`<tr><td><b>${esc(p.proposal_no)}</b><small>${esc(p.client_name)} · ${esc(p.client_email)}</small></td><td>${esc(p.title)}</td><td>${money(p.amount_paise)}</td><td><span class="status status-${esc(p.status)}">${esc(p.status)}</span></td><td>${p.valid_until?fmtDate(p.valid_until):'—'}</td><td><a href="/admin/proposals/${p.id}/print" target="_blank" rel="noreferrer">Print / PDF</a><a class="panel-link" href="/proposal/${encodeURIComponent(p.share_token)}" target="_blank" rel="noreferrer">Customer view</a><form method="post" action="/admin/proposals/${p.id}/send"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><button class="invoice-action-button">Email proposal</button></form><form class="proposal-status-form" method="post" action="/admin/proposals/${p.id}/status"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${select('status','Status',p.status,[['draft','Draft'],['sent','Sent'],['accepted','Accepted'],['declined','Declined'],['expired','Expired']])}<button class="invoice-action-button">Update</button></form></td></tr>`).join('')||'<tr><td colspan="6" class="empty-cell">No proposals yet.</td></tr>';
      const body=`${notice(req.query.saved?'Proposal saved.':'')}${req.query.sent?notice('Proposal email sent through configured email service.'):''}${req.query.error?notice(req.query.error,'danger'):''}<div class="admin-section-lead"><p>Create a written scope and quotation. The customer page contains no payment action. Use Print / PDF and choose “Save as PDF” to export a shareable proposal.</p></div><section class="invoice-layout"><article class="panel"><span class="admin-kicker">NEW PROJECT PROPOSAL</span><h2>Prepare a written quote</h2><form method="post" action="/admin/proposals" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('client_name','Customer name')}${field('client_email','Customer email','','email')}${field('title','Proposal title')}${area('description','Scope and deliverables','',5)}${field('amount_rupees','Proposed total (₹)','','number')}${field('valid_days','Validity (days)','15','number')}${area('terms','Payment milestones / terms','',4)}<button class="admin-button admin-button-primary">Create proposal</button></form></article><article class="panel"><span class="admin-kicker">QUOTE WORKFLOW</span><h2>Review before billing</h2><p>Keep project scope, amount and validity aligned with what the customer approved. Mark the proposal accepted after you have documented the customer’s approval.</p><div class="mini-note">Email delivery requires Brevo credentials in protected Railway variables. Print / PDF remains available without email setup.</div></article></section><section class="panel recent-panel"><div class="panel-heading"><div><span class="admin-kicker">PROPOSALS</span><h2>Recent quotes</h2></div></div><div class="table-wrap"><table><thead><tr><th>Proposal / customer</th><th>Title</th><th>Amount</th><th>Status</th><th>Valid until</th><th>Actions</th></tr></thead><tbody>${items}</tbody></table></div></section>`;
      res.send(shell('Quotes & proposals','/proposals',body,req.adminSession.csrf));
    }catch(error){next(error);}
  });
  router.post('/admin/proposals',async(req,res,next)=>{
    const name=String(req.body.client_name||'').trim().slice(0,120),email=String(req.body.client_email||'').trim().slice(0,200),title=String(req.body.title||'').trim().slice(0,180),description=String(req.body.description||'').trim().slice(0,10000),amount=Number(req.body.amount_rupees),days=Number(req.body.valid_days||15),terms=String(req.body.terms||'').trim().slice(0,4000);
    if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!title||!description||!Number.isFinite(amount)||amount<1||amount>10000000||Math.round(amount*100)!==amount*100||!Number.isInteger(days)||days<1||days>90)return res.status(400).send('Check customer details, proposal scope, amount and validity.');
    try{const token=crypto.randomBytes(24).toString('hex');const insert=await db.query("INSERT INTO proposals(proposal_no,share_token,client_name,client_email,title,description,amount_paise,valid_until,terms,status) VALUES('PENDING',$1,$2,$3,$4,$5,$6,current_date+$7,$8,'draft') RETURNING id",[token,name,email,title,description,Math.round(amount*100),days,terms]);const id=insert.rows[0].id,number=`ZT-Q-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String(id).padStart(4,'0')}`;await db.query('UPDATE proposals SET proposal_no=$1 WHERE id=$2',[number,id]);await audit(db,req,'created','proposal',id,number);res.redirect(303,'/admin/proposals?saved=1');}catch(error){next(error);}
  });
  router.post('/admin/proposals/:id/status',async(req,res,next)=>{
    const status=['draft','sent','accepted','declined','expired'].includes(req.body.status)?req.body.status:'draft';
    try{await db.query('UPDATE proposals SET status=$1,sent_at=CASE WHEN $1=\'sent\' THEN COALESCE(sent_at,now()) ELSE sent_at END,updated_at=now() WHERE id=$2',[status,Number(req.params.id)]);await audit(db,req,'status_changed','proposal',req.params.id,status);res.redirect(303,'/admin/proposals?saved=1');}catch(error){next(error);}
  });
  router.post('/admin/proposals/:id/send',async(req,res,next)=>{
    try{const {rows}=await db.query("SELECT * FROM proposals WHERE id=$1 AND status IN ('draft','sent')",[Number(req.params.id)]);if(!rows[0])return res.redirect(303,'/admin/proposals?error='+encodeURIComponent('Proposal is not available to send.'));const p=rows[0],settings=await db.query('SELECT value FROM site_settings WHERE key=\'display_name\''),brand=settings.rows[0]?.value||'ZuTech',base=(process.env.PUBLIC_BASE_URL||'').replace(/\/$/,''),url=`${base}/proposal/${encodeURIComponent(p.share_token)}`,sent=await sendBusinessEmail({to:p.client_email,subject:`${brand} proposal ${p.proposal_no}: ${p.title}`,text:`Hello ${p.client_name},\n\nYour project proposal is ready: ${url}\n\nProposed total: ${money(p.amount_paise)}\nValid through: ${p.valid_until?new Date(p.valid_until).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'}):'as discussed'}\n\nReply to this email or contact support if you would like to discuss the scope.`});if(!sent)return res.redirect(303,'/admin/proposals?error='+encodeURIComponent('Email was not sent. Configure BREVO_API_KEY and EMAIL_FROM in Railway, then try again.'));await db.query("UPDATE proposals SET status='sent',sent_at=now(),updated_at=now() WHERE id=$1",[p.id]);await audit(db,req,'emailed','proposal',p.id,p.client_email);res.redirect(303,'/admin/proposals?sent=1');}catch(error){next(error);}
  });
  router.get('/admin/proposals/:id/print',async(req,res,next)=>{
    try{const {rows}=await db.query('SELECT * FROM proposals WHERE id=$1',[Number(req.params.id)]);if(!rows[0])return res.status(404).send('Proposal not found.');const p=rows[0],settings=await db.query('SELECT key,value FROM site_settings'),s=Object.fromEntries(settings.rows.map(r=>[r.key,r.value]));res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.proposal_no)} · ZuTech</title><style>body{font:15px/1.65 Arial,sans-serif;color:#202820;max-width:850px;margin:50px auto;padding:0 24px}.top{display:flex;justify-content:space-between;border-bottom:3px solid #d8fb7a;padding-bottom:24px}.brand{font-size:24px;font-weight:800}.muted{color:#677066}.box{background:#f3f5ef;padding:22px;margin:25px 0}.total{font-size:24px;font-weight:700}button{padding:12px 18px;background:#1a251d;color:white;border:0;border-radius:4px}@media print{button{display:none}body{margin:0;max-width:none}}</style></head><body><div class="top"><div><div class="brand">${esc(s.display_name||'ZuTech')}</div><div class="muted">${esc(s.legal_name||'')}${s.business_address?`<br>${esc(s.business_address).replace(/\n/g,'<br>')}`:''}${s.support_email?`<br>${esc(s.support_email)}`:''}</div>${s.gstin?`<div class="muted">GSTIN: ${esc(s.gstin)}</div>`:''}</div><div><b>PROJECT PROPOSAL</b><br>${esc(p.proposal_no)}<br>Created: ${fmtDate(p.created_at)}<br>Valid until: ${p.valid_until?fmtDate(p.valid_until):'As discussed'}</div></div><h1>${esc(p.title)}</h1><p>Prepared for <b>${esc(p.client_name)}</b><br>${esc(p.client_email)}</p><div class="box"><b>Scope and deliverables</b><p>${esc(p.description).replace(/\n/g,'<br>')}</p></div>${p.terms?`<div class="box"><b>Payment milestones and terms</b><p>${esc(p.terms).replace(/\n/g,'<br>')}</p></div>`:''}<p class="total">Proposed total: ${money(p.amount_paise)}</p><p class="muted">This proposal becomes a project commitment only after the scope, schedule, taxes if applicable and payment terms are accepted in writing by both parties.</p><button onclick="window.print()">Print / Save as PDF</button></body></html>`);}catch(error){next(error);}
  });

  router.get('/admin/reports',async(req,res,next)=>{
    try{
      const results=await Promise.all([db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE created_at>=date_trunc('month',now()))::int AS month,count(*) FILTER(WHERE status='new')::int AS open FROM enquiries"),db.query("SELECT count(*)::int AS total,coalesce(sum(amount_paid_paise),0)::bigint AS received,count(*) FILTER(WHERE status IN ('created','partially_paid'))::int AS pending FROM invoices"),db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='booked')::int AS upcoming FROM consultation_bookings"),db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='accepted')::int AS accepted FROM proposals"),db.query('SELECT id,admin_name,action,entity,entity_id,details,created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 120')]);
      const statusRows=await db.query('SELECT status,count(*)::int AS total FROM enquiries GROUP BY status ORDER BY status');
      const auditRows=results[4].rows.map(row=>`<tr><td>${fmtDate(row.created_at)}</td><td>${esc(row.admin_name)}</td><td>${esc(row.action)}</td><td>${esc(row.entity)} ${esc(row.entity_id)}</td><td>${esc(row.details)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-cell">Admin changes will be recorded here.</td></tr>';
      const body=`<section class="stat-grid"><article class="stat-card"><span>ENQUIRIES THIS MONTH</span><b>${results[0].rows[0].month}</b><small>${results[0].rows[0].open} new requests</small></article><article class="stat-card"><span>PAYMENTS RECEIVED</span><b>${money(results[1].rows[0].received)}</b><small>${results[1].rows[0].pending} pending invoices</small></article><article class="stat-card"><span>CONSULTATIONS</span><b>${results[2].rows[0].total}</b><small>${results[2].rows[0].upcoming} booked</small></article><article class="stat-card"><span>ACCEPTED PROPOSALS</span><b>${results[3].rows[0].accepted}</b><small>${results[3].rows[0].total} total proposals</small></article></section><section class="panel"><div class="panel-heading"><div><span class="admin-kicker">DATA & HISTORY</span><h2>Reports and backups</h2></div></div><p>Download a CSV summary or a private JSON backup. The backup contains customer contact and project data; store it securely.</p><div class="report-actions"><a class="admin-button admin-button-primary" href="/admin/reports.csv">Download report CSV</a><a class="admin-button admin-button-dark" href="/admin/backup.json" onclick="return confirm('Download private customer and business data backup?')">Download data backup</a></div><h3>Enquiry status</h3><div class="report-status-list">${statusRows.rows.map(r=>`<span><b>${esc(statusLabel(r.status))}</b> ${r.total}</span>`).join('')}</div></section><section class="panel recent-panel"><div class="panel-heading"><div><span class="admin-kicker">ADMIN CHANGE HISTORY</span><h2>Audit log</h2></div></div><div class="table-wrap"><table><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>${auditRows}</tbody></table></div></section>`;
      res.send(shell('Reports & backup','/reports',body,req.adminSession.csrf));
    }catch(error){next(error);}
  });
  router.get('/admin/reports.csv',async(req,res,next)=>{
    try{const [enquiries,invoices,bookings,proposals]=await Promise.all([db.query('SELECT id,name,email,phone,project_type,budget_range,status,created_at FROM enquiries ORDER BY created_at DESC LIMIT 10000'),db.query('SELECT invoice_no,client_name,client_email,description,amount_paise,amount_paid_paise,status,paid_at,created_at FROM invoices ORDER BY created_at DESC LIMIT 10000'),db.query('SELECT b.name,b.email,b.phone,b.status,s.starts_at FROM consultation_bookings b JOIN consultation_slots s ON s.id=b.slot_id ORDER BY s.starts_at DESC LIMIT 10000'),db.query('SELECT proposal_no,client_name,client_email,title,amount_paise,status,valid_until,created_at FROM proposals ORDER BY created_at DESC LIMIT 10000')]);const csv=x=>{let v=String(x??'');if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};const lines=[['REPORT','ZuTech business summary'],['SECTION','Enquiries'],['id','name','email','phone','service','budget','status','created_at'],...enquiries.rows.map(r=>[r.id,r.name,r.email,r.phone,r.project_type,r.budget_range,r.status,r.created_at]),[],['SECTION','Invoices'],['invoice_no','client_name','client_email','description','amount_paise','amount_paid_paise','status','paid_at','created_at'],...invoices.rows.map(r=>[r.invoice_no,r.client_name,r.client_email,r.description,r.amount_paise,r.amount_paid_paise,r.status,r.paid_at,r.created_at]),[],['SECTION','Consultations'],['name','email','phone','status','starts_at'],...bookings.rows.map(r=>[r.name,r.email,r.phone,r.status,r.starts_at]),[],['SECTION','Proposals'],['proposal_no','client_name','client_email','title','amount_paise','status','valid_until','created_at'],...proposals.rows.map(r=>[r.proposal_no,r.client_name,r.client_email,r.title,r.amount_paise,r.status,r.valid_until,r.created_at])].map(row=>row.map(csv).join(',')).join('\r\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="zutech-business-report.csv"');res.send('\ufeff'+lines);}catch(error){next(error);}
  });
  router.get('/admin/backup.json',async(req,res,next)=>{
    try{const tables=['site_settings','services','portfolio','testimonials','insights','enquiries','consultation_slots','consultation_bookings','proposals','invoices','invoice_refunds','admin_audit_logs'];const results=await Promise.all(tables.map(table=>db.query(`SELECT * FROM ${table} ORDER BY 1 LIMIT 20000`)));const backup={generated_at:new Date().toISOString(),warning:'Contains private customer and business records. Store securely.',data:Object.fromEntries(tables.map((name,i)=>[name,results[i].rows]))};await audit(db,req,'exported','backup','json');res.setHeader('Content-Type','application/json');res.setHeader('Content-Disposition','attachment; filename="zutech-private-backup.json"');res.send(JSON.stringify(backup,null,2));}catch(error){next(error);}
  });

  router.get('/admin/invoices', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 100');
      const invoices = rows.map(row=>`<tr><td><b>${esc(row.invoice_no)}</b><small>${esc(row.client_name)} · ${esc(row.client_email)}</small></td><td>${esc(row.description)}</td><td>${money(row.amount_paise)}${Number(row.amount_paid_paise)>0&&Number(row.amount_paid_paise)<Number(row.amount_paise)?`<small>Paid ${money(row.amount_paid_paise)}</small>`:''}</td><td><span class="status status-${esc(row.status)}">${esc(row.status.replace('_',' '))}</span></td><td>${fmtDate(row.created_at)}</td><td><a href="/admin/invoices/${row.id}/print" target="_blank" rel="noreferrer">Invoice PDF</a>${row.payment_url?`<a target="_blank" rel="noreferrer" href="${esc(row.payment_url)}">Open pay link</a><button class="copy-link" type="button" data-copy="${esc(row.payment_url)}">Copy</button>`:'—'}${row.status==='created'?`<form class="invoice-action" method="post" action="/admin/invoices/${row.id}/cancel" onsubmit="return confirm('Cancel this payment link with Razorpay?')"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><button>Cancel link</button></form>`:''}${['paid','partially_refunded'].includes(row.status)&&row.razorpay_payment_id?`<form class="invoice-action refund-action" method="post" action="/admin/invoices/${row.id}/refund" onsubmit="return confirm('Submit this refund to Razorpay?')"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}"><input name="amount_rupees" type="number" min="1" step="0.01" placeholder="Full refund or amount"><button>Issue refund</button></form>`:''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-cell">No invoices yet.</td></tr>';
      const gateway = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
      const body = `${notice(req.query.created?'Invoice and payment link created.':'')}${req.query.refunded?notice('Refund request sent to Razorpay. Check the invoice status for updates.'):''}${req.query.cancelled?notice('Payment link cancelled.'):''}${req.query.error?notice(req.query.error,'danger'):''}<div class="admin-section-lead"><p>Create an invoice only for a real, agreed ZuTech service. A payment link is generated only when Razorpay keys are configured. The link is hosted by Razorpay; card details never pass through this site.</p></div><section class="invoice-layout"><article class="panel"><span class="admin-kicker">NEW PROJECT PAYMENT</span><h2>Create invoice</h2><form method="post" action="/admin/invoices" class="manage-form"><input type="hidden" name="csrf" value="${esc(req.adminSession.csrf)}">${field('client_name','Customer name','','text')}${field('client_email','Customer email','','email')}${field('client_phone','Customer phone (optional)','','tel')}${area('description','Agreed service / milestone','',3)}${field('amount_rupees','Taxable amount (INR)','','number','Enter the agreed service value before GST.')}<label class="admin-field"><span>GST rate</span><select name="tax_rate_percent"><option value="0">No GST / not applicable</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></label>${field('sac_code','SAC code (optional)','','text')}${field('place_of_supply','Place of supply (optional)','','text')}${field('expires_days','Payment link validity (days)','15','number')}<label class="admin-field consent-line"><span><input type="checkbox" name="accepted_quote" value="yes" required> I confirm the customer accepted this service and amount in writing.</span></label><button class="admin-button admin-button-primary" ${gateway?'':'disabled'}>${gateway?'Create invoice & payment link':'Configure Razorpay keys first'}</button></form>${!gateway?'<p class="mini-note">Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as protected Railway variables after Razorpay activates your account.</p>':''}</article><article class="panel"><span class="admin-kicker">GATEWAY STATUS</span><h2>${gateway?(process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')?'Razorpay Live':'Razorpay Test'):'Not connected'}</h2><p>${gateway?'Invoice links use the server-side API secret. Payment state is updated only by a verified Razorpay webhook.':'You can prepare the website and admin profile before adding gateway credentials.'}</p><div class="secret-list"><span>API key <b>${process.env.RAZORPAY_KEY_ID?'Configured':'Missing'}</b></span><span>Webhook secret <b>${process.env.RAZORPAY_WEBHOOK_SECRET?'Configured':'Missing'}</b></span></div><code class="webhook-url">${esc(process.env.PUBLIC_BASE_URL||'https://your-domain.example')}/webhooks/razorpay</code></article></section><section class="panel recent-panel"><div class="panel-heading"><div><span class="admin-kicker">BILLING RECORDS</span><h2>Invoices</h2></div></div><div class="table-wrap"><table><thead><tr><th>Invoice / customer</th><th>Service</th><th>Amount</th><th>Status</th><th>Created</th><th>Payment link / action</th></tr></thead><tbody>${invoices}</tbody></table></div></section><script>document.querySelectorAll('.copy-link').forEach(b=>b.onclick=()=>navigator.clipboard.writeText(b.dataset.copy).then(()=>{b.textContent='Copied'}));</script>`;
      res.send(shell('Invoices & payments','/invoices',body,req.adminSession.csrf));
    } catch(error){next(error);}
  });
  router.post('/admin/invoices', async (req, res, next) => {
    const name=String(req.body.client_name||'').trim().slice(0,120), email=String(req.body.client_email||'').trim().slice(0,200), phone=String(req.body.client_phone||'').trim().slice(0,24), description=String(req.body.description||'').trim().slice(0,500), amount=Number(req.body.amount_rupees), taxRate=Number(req.body.tax_rate_percent||0), sac=String(req.body.sac_code||'').trim().slice(0,24), place=String(req.body.place_of_supply||'').trim().slice(0,120), days=Number(req.body.expires_days||15);
    if(req.body.accepted_quote!=='yes'||!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!description||!Number.isFinite(amount)||amount<1||amount>10000000||Math.round(amount*100)!==amount*100||![0,5,12,18,28].includes(taxRate)||!Number.isInteger(days)||days<1||days>180) return res.redirect(303,'/admin/invoices?error='+encodeURIComponent('Confirm the accepted written quotation and check customer details, amount, GST rate and link expiry.'));
    const businessSettings=await db.query("SELECT value FROM site_settings WHERE key='gstin'");
    if(taxRate>0&&!/^[0-9A-Z]{15}$/.test(String(businessSettings.rows[0]?.value||'').trim().toUpperCase())) return res.redirect(303,'/admin/invoices?error='+encodeURIComponent('A valid business GSTIN must be saved in Business settings before adding GST.'));
    const taxablePaise=Math.round(amount*100), taxPaise=Math.round(taxablePaise*taxRate/100), totalPaise=taxablePaise+taxPaise;
    const key=process.env.RAZORPAY_KEY_ID, secret=process.env.RAZORPAY_KEY_SECRET;
    if(!key||!secret) return res.redirect(303,'/admin/invoices?error='+encodeURIComponent('Razorpay API credentials are not configured.'));
    let invoiceId = null;
    try {
      const insert=await db.query("INSERT INTO invoices(invoice_no,client_name,client_email,client_phone,description,amount_paise,taxable_amount_paise,tax_rate_bps,tax_amount_paise,sac_code,place_of_supply,status) VALUES('PENDING',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'creating') RETURNING id",[name,email,phone,description,totalPaise,taxablePaise,taxRate*100,taxPaise,sac,place]);
      const id=insert.rows[0].id; invoiceId=id;
      const invoiceNo=`ZT-${new Date().toISOString().slice(0,7).replace('-','')}-${String(id).padStart(5,'0')}`;
      const base=(process.env.PUBLIC_BASE_URL||'').replace(/\/$/,'');
      const expireBy=Math.floor(Date.now()/1000)+days*86400;
      const response=await fetch('https://api.razorpay.com/v1/payment_links',{method:'POST',headers:{'Authorization':`Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,'Content-Type':'application/json'},body:JSON.stringify({amount:totalPaise,currency:'INR',description,reference_id:invoiceNo,customer:{name,email,...(phone?{contact:phone}:{})},notify:{sms:false,email:false},reminder_enable:false,expire_by:expireBy,notes:{invoice_no:invoiceNo},...(base?{callback_url:`${base}/payments/complete`,callback_method:'get'}:{})})});
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

  router.get('/admin/invoices/:id/print', async (req,res,next) => {
    try {
      const {rows}=await db.query('SELECT * FROM invoices WHERE id=$1',[Number(req.params.id)]);
      if(!rows[0])return res.status(404).send('Invoice not found.');
      const invoice=rows[0],settings=await db.query('SELECT key,value FROM site_settings'),s=Object.fromEntries(settings.rows.map(r=>[r.key,r.value]));
      const base=Number(invoice.taxable_amount_paise||invoice.amount_paise),tax=Number(invoice.tax_amount_paise||0),rate=Number(invoice.tax_rate_bps||0)/100;
      res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(invoice.invoice_no)} · Tax invoice</title><style>body{font:15px/1.6 Arial,sans-serif;color:#202820;max-width:850px;margin:46px auto;padding:0 24px}.top{display:flex;justify-content:space-between;border-bottom:3px solid #d8fb7a;padding:0 0 22px}.brand{font-size:24px;font-weight:800}.muted{color:#687068}.box{background:#f3f5ef;padding:20px;margin:24px 0}.row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #e4e8df}.total{font-size:23px;font-weight:700;border:0}button{padding:12px 18px;background:#1a251d;color:#fff;border:0;border-radius:4px}@media print{button{display:none}body{margin:0;max-width:none}}</style></head><body><header class="top"><div><div class="brand">${esc(s.display_name||'ZuTech')}</div><div class="muted">${esc(s.legal_name||'')}${s.business_address?`<br>${esc(s.business_address).replace(/\n/g,'<br>')}`:''}${s.support_email?`<br>${esc(s.support_email)}`:''}${s.support_phone?`<br>${esc(s.support_phone)}`:''}</div>${s.gstin?`<p><b>GSTIN:</b> ${esc(s.gstin)}</p>`:''}</div><div><b>${rate?'TAX INVOICE':'INVOICE'}</b><br>${esc(invoice.invoice_no)}<br>Date: ${fmtDate(invoice.created_at)}<br>Status: ${esc(invoice.status.replaceAll('_',' '))}</div></header><section class="box"><b>Bill to</b><br>${esc(invoice.client_name)}<br>${esc(invoice.client_email)}${invoice.client_phone?`<br>${esc(invoice.client_phone)}`:''}<p><b>Service:</b> ${esc(invoice.description)}</p>${invoice.sac_code?`<p><b>SAC:</b> ${esc(invoice.sac_code)}</p>`:''}${invoice.place_of_supply?`<p><b>Place of supply:</b> ${esc(invoice.place_of_supply)}</p>`:''}</section><div class="row"><span>Taxable value</span><b>${money(base)}</b></div>${rate?`<div class="row"><span>GST (${rate}%)</span><b>${money(tax)}</b></div>`:''}<div class="row total"><span>Total payable</span><b>${money(invoice.amount_paise)}</b></div>${Number(invoice.amount_paid_paise)>0?`<div class="row"><span>Amount received</span><b>${money(invoice.amount_paid_paise)}</b></div><div class="row"><span>Balance</span><b>${money(Math.max(0,Number(invoice.amount_paise)-Number(invoice.amount_paid_paise)))}</b></div>`:''}<p class="muted">Payment status is shown from the verified payment record. Save or print this page as PDF.</p><button onclick="window.print()">Print / Save as PDF</button></body></html>`);
    }catch(error){next(error);}
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
