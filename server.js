const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');
const createAdminRouter = require('./admin');

const app = express();
app.set('trust proxy', 1);
const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false } })
  : null;

app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(express.static('public'));
app.use(createAdminRouter({ express, db, sendBusinessEmail: (...args) => sendBusinessEmail(...args) }));

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeUrl = value => /^https?:\/\//i.test(String(value || '')) ? String(value).trim() : '';
const publicDate = value => value ? new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}) : '';
const icon = (name, size = 24) => {
  const paths = {
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18.5h4"/>',
    cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.7 12.1a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 1.9-1.4L22 8H5"/>',
    code: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
};

const services = [
  { icon: 'globe', kicker: '01 / WEB', name: 'Websites & platforms', copy: 'Fast, accessible websites that give your business a confident home online.' },
  { icon: 'phone', kicker: '02 / MOBILE', name: 'Mobile applications', copy: 'Useful Android experiences designed around the people who use them.' },
  { icon: 'cart', kicker: '03 / COMMERCE', name: 'E-commerce solutions', copy: 'Product discovery, secure checkout and order journeys made simpler.' },
  { icon: 'code', kicker: '04 / SOFTWARE', name: 'Custom software', copy: 'Dashboards, integrations and focused tools for everyday work.' },
];

const page = (title, body, settings = {}) => {
  const brand = esc(settings.display_name || 'ZuTech');
  const identity = settings.legal_name ? `<p class="footer-legal"><b>${esc(settings.legal_name)}</b>${settings.business_address ? `<br>${esc(settings.business_address).replace(/\n/g,'<br>')}` : ''}</p>` : '';
  const support = [settings.support_email ? `<a href="mailto:${esc(settings.support_email)}">${esc(settings.support_email)}</a>` : '', settings.support_phone ? `<a href="tel:${esc(settings.support_phone)}">${esc(settings.support_phone)}</a>` : '', settings.support_hours ? `<span>${esc(settings.support_hours)}</span>` : ''].filter(Boolean).join('<span class="support-sep">·</span>');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#151d18"><meta name="description" content="${brand} provides website development, mobile applications, e-commerce services and custom software. Contact the studio to discuss scope and pricing."><title>${esc(title)} | ${brand}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/advanced.css"></head>
<body><header class="site-header"><a class="brand" href="/" aria-label="ZuTech home"><span class="brand-mark">Z</span><span class="brand-name">zu<span>tech</span><small> DIGITAL STUDIO</small></span></a><button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false"><span></span><span></span></button><nav class="main-nav"><a href="/#capabilities">What we do</a><a href="/#work">Work</a><a href="/#process">Approach</a><a class="nav-cta" href="/contact">Start a project ${icon('arrow', 16)}</a></nav></header><main>${body}</main>
<footer class="site-footer"><div class="footer-top"><a class="brand brand-light" href="/"><span class="brand-mark">Z</span><span class="brand-name">zu<span>tech</span><small> DIGITAL STUDIO</small></span></a><p>Websites, apps and software.<br>Made with purpose.</p><a class="footer-contact" href="/contact">Have a project in mind? ${icon('arrow', 16)}</a></div><div class="footer-business">${identity}<div class="footer-support">${support}</div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${brand}. All rights reserved.</span><div class="footer-links"><a href="/about">About</a><a href="/pricing">Pricing</a><a href="/quote">Get an estimate</a><a href="/consult">Book a call</a><a href="/insights">Insights</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refund">Refunds & cancellations</a><a href="/delivery">Service delivery</a><a href="/contact">Contact</a></div></div></footer>
<script>const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.main-nav');toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.setAttribute('aria-label',open?'Open navigation':'Close navigation');nav.classList.toggle('is-open',!open)});nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('is-open');toggle?.setAttribute('aria-expanded','false')}));</script></body></html>`;
};

const readSettings = async () => {
  if (!db) return {};
  const { rows } = await db.query('SELECT key,value FROM site_settings');
  return Object.fromEntries(rows.map(row => [row.key, row.value]));
};

const sendBusinessEmail = async ({ to, subject, text }) => {
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM || !to) return false;
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { email: process.env.EMAIL_FROM, name: 'ZuTech' }, to: [{ email: to }], subject, textContent: text }),
    });
    if (!response.ok) throw new Error(`Brevo returned ${response.status}`);
    return true;
  } catch (error) {
    console.error('Business email notification failed:', error.message);
    return false;
  }
};

app.get('/', async (req, res, next) => {
  try {
  const settings = await readSettings();
  const activeServices = db ? (await db.query('SELECT * FROM services WHERE active=true ORDER BY position,id')).rows : services.map((service, i) => ({ id:i+1, name:service.name, summary:service.copy, price_label:'Custom quotation after written scope', delivery_note:'' }));
  const portfolioItems = db ? (await db.query('SELECT * FROM portfolio WHERE published=true ORDER BY position,id DESC LIMIT 9')).rows : [];
  const testimonials = db ? (await db.query('SELECT * FROM testimonials WHERE published=true ORDER BY position,id DESC LIMIT 6')).rows : [];
  const articles = db ? (await db.query('SELECT slug,title,summary,published_at FROM insights WHERE published=true ORDER BY published_at DESC LIMIT 3')).rows : [];
  const portfolioSection = portfolioItems.length ? `<section class="live-work"><div class="section-overline">PORTFOLIO <span>/ SELECTED WORK</span></div><h2>Selected projects.</h2><div class="live-work-grid">${portfolioItems.map(item => `<article class="live-work-card"><a href="${item.is_concept ? (safeUrl(item.project_url)||'#work') : `/work/${item.id}`}" ${item.is_concept&&item.project_url?'target="_blank" rel="noreferrer"':''}>${safeUrl(item.image_url)?`<img src="${esc(safeUrl(item.image_url))}" alt="${esc(item.title)}" loading="lazy">`:'<span class="work-placeholder">ZT</span>'}</a><div class="live-work-meta"><span>${esc(item.category||'Digital project')}</span><span>${item.is_concept?'CONCEPT / DEMO':esc(item.client_name||'CLIENT PROJECT')}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p>${!item.is_concept?`<a class="case-study-link" href="/work/${item.id}">Read the case study ${icon('arrow',14)}</a>`:''}</article>`).join('')}</div></section>` : '';
  const testimonialSection = testimonials.length ? `<section class="testimonial-section"><div class="section-overline">CLIENT NOTES <span>/ REAL EXPERIENCES</span></div><h2>Good work, in their words.</h2><div class="testimonial-grid">${testimonials.map(item=>`<article class="testimonial-card"><div class="testimonial-stars" aria-label="${Number(item.rating)||5} out of 5">${'★'.repeat(Math.max(1,Math.min(5,Number(item.rating)||5)))}</div><blockquote>“${esc(item.quote)}”</blockquote><div class="testimonial-by"><b>${esc(item.customer_name)}</b><span>${esc([item.role,item.company].filter(Boolean).join(' · '))}</span></div></article>`).join('')}</div></section>` : '';
  const insightsSection = articles.length ? `<section class="insights-teaser"><div><div class="section-overline">FIELD NOTES <span>/ PRACTICAL IDEAS</span></div><h2>Ideas for your next digital move.</h2></div><div class="insight-teaser-grid">${articles.map(article=>`<a class="insight-teaser-card" href="/insights/${encodeURIComponent(article.slug)}"><small>${publicDate(article.published_at)}</small><h3>${esc(article.title)}</h3><p>${esc(article.summary)}</p><span>Read article ↗</span></a>`).join('')}</div><a class="text-link" href="/insights">Browse all insights ↗</a></section>` : '';
  res.send(page('Digital design and development studio', `
<section class="signature-hero"><div class="signature-noise"></div><div class="signature-copy"><div class="signature-kicker"><i></i> DIGITAL DESIGN · ENGINEERING · PRODUCT</div><h1>Make digital<br>work <em>beautifully.</em></h1><p>We design and build the websites, applications and tools that help good businesses do their best work.</p><div class="signature-actions"><a class="button button-lime" href="/contact">Talk about your project ${icon('arrow',17)}</a><a class="signature-link" href="#work">See what we make <span>↓</span></a></div><div class="signature-foot"><span>STRATEGY</span><b>·</b><span>DESIGN</span><b>·</b><span>DEVELOPMENT</span></div></div><div class="product-stage" aria-label="Website and mobile interface previews"><div class="stage-glow"></div><div class="stage-note note-a"><span class="note-symbol">✳</span><span><b>One thoughtful team</b><small>From first sketch to launch</small></span></div><div class="browser-card"><div class="browser-bar"><span class="browser-dots"><i></i><i></i><i></i></span><span>atelier.store</span><span>⌘</span></div><div class="store-preview"><div class="store-nav"><b>FORME</b><span>OBJECTS & LIVING</span><span>SHOP &nbsp; ABOUT &nbsp; BAG 0</span></div><div class="store-copy"><small>THE EVERYDAY COLLECTION</small><strong>Made for<br>slower <i>mornings.</i></strong><span>Considered pieces for the spaces you call home.</span><button>DISCOVER THE COLLECTION ↗</button></div><div class="store-object"><div class="object-sun"></div><div class="vase vase-one"></div><div class="vase vase-two"></div><div class="object-book"></div></div><div class="store-index">01 <span>—</span> 04</div></div></div><div class="phone-preview"><div class="phone-screen"><div class="phone-notch"></div><span class="phone-label">GOODDAY / TODAY</span><strong>Make space<br>for <i>you.</i></strong><div class="phone-circle">✳</div><span class="phone-cta">EXPLORE YOUR PLAN <b>↗</b></span><div class="phone-foot">HOME &nbsp;&nbsp; JOURNAL &nbsp;&nbsp; PROFILE</div></div></div><div class="stage-note note-b"><span class="note-check">${icon('check',15)}</span><span><b>Thought through.</b><small>Built to work in real life.</small></span></div><div class="stage-orbit orbit-large"></div><div class="stage-orbit orbit-small"></div></div><a class="hero-scroll" href="#capabilities">SCROLL TO EXPLORE <span>↓</span></a></section>
<section class="studio-strip"><span>SMALL ENOUGH TO CARE ABOUT THE DETAILS</span><i></i><span>CAPABLE ENOUGH TO BUILD THE WHOLE THING</span><i></i><span>ALWAYS BUILT AROUND YOUR GOALS</span></section>
<section class="capabilities-section" id="capabilities"><div class="section-overline">01 <span> / WHAT WE DO</span></div><div class="capabilities-head"><h2>One partner.<br><i>Every moving part.</i></h2><p>From your first online presence to the custom system behind your operations, we bring design and technology together in one place.</p></div><div class="capability-grid">${activeServices.map((s,i)=>`<article class="capability-card"><div class="capability-index">0${i+1}<span>${icon(services[i%services.length].icon,19)}</span></div><h3>${esc(s.name)}</h3><p>${esc(s.summary||s.copy)}</p><div class="service-pricing">${esc(s.price_label||'Request a written quotation')}</div>${s.delivery_note?`<div class="service-delivery">${esc(s.delivery_note)}</div>`:''}<a href="/contact">Ask about this service <span>↗</span></a></article>`).join('')}</div></section>
<section class="work-section" id="work"><div class="work-heading"><div><div class="section-overline">02 <span> / INTERFACE STUDIES</span></div><h2>Good work should<br><i>show its thinking.</i></h2></div><p>A look at the kinds of digital experiences we can shape. These visual studies are examples of our design approach, not client projects.</p></div><div class="study-grid"><article class="study study-commerce"><div class="study-top"><span>CONCEPT 01 / COMMERCE</span><span>↗</span></div><div class="commerce-frame"><div class="commerce-head"><b>FOLK</b><span>HOME GOODS&nbsp;&nbsp; NEW IN&nbsp;&nbsp; OUR STORY</span><span>BAG (0)</span></div><div class="commerce-body"><span>THE HOME, RECONSIDERED</span><strong>Less, but<br><i>better.</i></strong><button>SHOP THE EDIT ↗</button></div><div class="commerce-still"><div></div><i></i></div></div><h3>Commerce, with a point of view.</h3><p>A calm, considered storefront built to make browsing feel effortless.</p></article><article class="study study-product"><div class="study-top"><span>CONCEPT 02 / DIGITAL PRODUCT</span><span>↗</span></div><div class="product-frame"><div class="dash-nav"><b>northstar<span>®</span></b><span>OVERVIEW &nbsp;&nbsp; PROJECTS &nbsp;&nbsp; TEAM</span><i>AM</i></div><div class="dash-welcome">MONDAY, 9:41 AM <b>Your day, in focus.</b></div><div class="dash-cards"><div><small>OPEN PROJECTS</small><b>08</b><span>↗ This week</span></div><div><small>TEAM CAPACITY</small><b>76%</b><span class="capacity"><i></i></span></div><div><small>NEXT MILESTONE</small><b>Brand launch</b><span>Thursday · 14:00</span></div></div><div class="dash-chart"><span>WEEKLY MOMENTUM</span><div class="chart-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div><h3>Complex work, made clear.</h3><p>A friendly operations dashboard that turns busy workflows into a clear next step.</p></article><article class="study study-mobile"><div class="study-top"><span>CONCEPT 03 / MOBILE</span><span>↗</span></div><div class="mobile-canvas"><div class="mobile-card"><div class="mobile-status">9:41 <span>●●● ▰</span></div><div class="mobile-brand">wellnest <i>☼</i></div><div class="mobile-message">A little better,<br><i>every day.</i></div><div class="mobile-illustration"><div class="mobile-disc"></div><div class="mobile-plant"></div><div class="mobile-pot"></div></div><div class="mobile-button">YOUR DAILY CHECK-IN <span>↗</span></div><div class="mobile-tabs">TODAY &nbsp;&nbsp;&nbsp; JOURNAL &nbsp;&nbsp;&nbsp; YOU</div></div></div><h3>Helpful, wherever you are.</h3><p>A mobile-first experience designed to feel natural in the palm of your hand.</p></article></div><div class="concept-note"><span>✳</span> Concept interfaces shown for illustration. Your project starts with your goals and your brief.</div></section>
${portfolioSection}${testimonialSection}<section class="method-section" id="process"><div class="method-left"><div class="section-overline section-overline-light">03 <span> / HOW WE WORK</span></div><h2>Nothing mysterious.<br><i>Just good work.</i></h2><p>Clear scope, regular communication and a finished product you understand how to use.</p><a href="/about">More about ZuTech <span>↗</span></a><div class="method-stamp">Z<br><small>STUDIO<br>NOTES</small></div></div><div class="method-list">${[['01','Get aligned','We learn what you need, who it is for and what a useful result looks like.'],['02','Plan the work','You receive a clear scope, a quotation and the next steps before we begin.'],['03','Design & build','We share progress as the product takes shape and keep feedback in the loop.'],['04','Hand it over','Your agreed deliverables are prepared and handed over with care.']].map(([n,title,text])=>`<article><span>${n}</span><div><h3>${title}</h3><p>${text}</p></div><i>↗</i></article>`).join('')}</div></section>
<section class="faq-section"><div class="section-overline">04 <span> / GOOD TO KNOW</span></div><div class="faq-layout"><div><h2>A few things<br><i>you might wonder.</i></h2><p>Still have a question? Tell us what you are thinking and we will give you a straightforward answer.</p><a href="/contact" class="faq-contact">Ask us directly ${icon('arrow',16)}</a></div><div class="faq-list"><details><summary>What kind of projects do you take on? <span>＋</span></summary><p>We work on business websites, e-commerce, Android applications, custom dashboards and software. If your idea crosses a few of these areas, we can discuss the full scope together.</p></details><details><summary>How does a project get started? <span>＋</span></summary><p>Send us a short description through the enquiry form. We will review it, ask any useful follow-up questions and prepare an agreed scope, quotation and timeline before work begins.</p></details><details><summary>How much will my project cost? <span>＋</span></summary><p>Cost depends on the features, design and integrations involved. Once we understand your requirements, we provide a written quotation so the scope and payment terms are clear before you commit.</p></details><details><summary>Can you help after launch? <span>＋</span></summary><p>Ongoing support or future improvements can be discussed and included in a separate agreed scope.</p></details></div></div></section>
${insightsSection}<section class="final-cta"><div class="cta-orbit"></div><div class="section-overline section-overline-light">YOUR IDEA, WITH A TEAM BEHIND IT</div><h2>Let's make something<br><i>worth using.</i></h2><p>Tell us where you want to go. We'll help you work out how to get there.</p><a class="button button-lime" href="/contact">Start a conversation ${icon('arrow',17)}</a><span class="cta-small">Clear next steps. No pressure to commit.</span></section>
`, settings));
  } catch (error) { next(error); }
});

app.get('/quote', async (req,res,next) => {
  try {
    const settings=await readSettings();
    const items=db?(await db.query('SELECT id,name,summary,price_min_paise,price_max_paise,price_label FROM services WHERE active=true ORDER BY position,id')).rows:[];
    const options=items.map(s=>`<option value="${s.id}" data-min="${Number(s.price_min_paise)||0}" data-max="${Number(s.price_max_paise)||0}">${esc(s.name)}</option>`).join('');
    const available=items.some(s=>Number(s.price_min_paise)>0&&Number(s.price_max_paise)>=Number(s.price_min_paise));
    const body=`<section class="inner-hero quote-hero"><div class="eyebrow">PROJECT SCOPE PLANNER</div><h1>Start with a clearer<br><span>project estimate.</span></h1><p>Choose a service and describe what you need. If a price range has been configured, we’ll show an indicative estimate; the final scope and quotation are confirmed with you in writing.</p></section><section class="quote-section"><form class="quote-form" method="post" action="/quote"><div class="quote-form-heading"><span>01 / YOUR PROJECT</span><span>NO PAYMENT REQUIRED</span></div>${items.length?`<label class="quote-field">Service<select name="service_id" id="quote-service" required><option value="">Choose a service</option>${options}</select></label>`:'<p>Services are currently being configured. You can still <a href="/contact">send a project enquiry</a>.</p>'}<div class="quote-estimate" id="quote-estimate" aria-live="polite"><small>INDICATIVE ESTIMATE</small><strong>${available?'Choose a service to see its estimate':'A written quote after scope review'}</strong><span>${available?'This is an initial planning range, not a final offer.':'We’ll review your requirements and send a clear written quotation.'}</span></div><label class="quote-field">Your name<input name="name" maxlength="120" autocomplete="name" required></label><div class="quote-form-row"><label class="quote-field">Email<input type="email" name="email" maxlength="200" autocomplete="email" required></label><label class="quote-field">Phone (optional)<input type="tel" name="phone" maxlength="24" autocomplete="tel"></label></div><label class="quote-field">What should the project do?<textarea name="requirements" rows="5" maxlength="3500" required placeholder="Describe the goal, important features and who will use it."></textarea></label><div class="quote-form-row"><label class="quote-field">Budget (optional)<select name="budget_range"><option value="">Not sure yet</option><option>Under ₹25,000</option><option>₹25,000–₹75,000</option><option>₹75,000–₹2,00,000</option><option>₹2,00,000+</option><option>Need guidance</option></select></label><label class="quote-field">Target timing (optional)<select name="timeline"><option value="">Flexible</option><option>Within 1 month</option><option>1–3 months</option><option>3–6 months</option><option>More than 6 months</option></select></label></div><label class="consent-check"><input type="checkbox" name="privacy_consent" value="yes" required><span>I have read the <a href="/privacy">Privacy Policy</a> and agree to be contacted about this estimate request.</span></label><button class="button button-primary" ${items.length?'':'disabled'}>Request a detailed quote ${icon('arrow',16)}</button><small>Submitting does not create a contract or charge.</small></form></section><script>const sel=document.getElementById('quote-service'),box=document.getElementById('quote-estimate');sel?.addEventListener('change',()=>{const o=sel.selectedOptions[0],lo=Number(o?.dataset.min),hi=Number(o?.dataset.max);box.innerHTML='<small>INDICATIVE ESTIMATE</small><strong>'+((lo>0&&hi>=lo)?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(lo/100)+' – '+new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(hi/100):'A written quote after scope review')+'</strong><span>This is an initial planning range, not a final offer. Final price depends on approved requirements and applicable taxes.</span>'});</script>`;
    res.send(page('Project estimate',body,settings));
  } catch(error){next(error);}
});

app.post('/quote', async (req,res,next) => {
  const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim(),phone=String(req.body.phone||'').trim(),requirements=String(req.body.requirements||'').trim(),budget=String(req.body.budget_range||'').trim(),timeline=String(req.body.timeline||'').trim(),serviceId=Number(req.body.service_id);
  if(!name||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||phone.length>24||!requirements||requirements.length>3500||req.body.privacy_consent!=='yes') return res.status(400).send('Please check the required details and privacy consent.');
  if(!db)return res.status(503).send('Quote requests are temporarily unavailable.');
  try {
    const svc=await db.query('SELECT id,name,price_min_paise,price_max_paise FROM services WHERE id=$1 AND active=true',[serviceId]);
    if(!svc.rowCount)return res.status(400).send('Please choose an available service.');
    const service=svc.rows[0],min=Number(service.price_min_paise)||0,max=Number(service.price_max_paise)||0;
    const estimate=min>0&&max>=min?`Indicative estimate shown: ₹${Math.round(min/100).toLocaleString('en-IN')}–₹${Math.round(max/100).toLocaleString('en-IN')}. `:'';
    const message=`${estimate}Requirements: ${requirements}\nTarget timing: ${timeline||'Flexible'}\nSubmitted through the project estimate planner.`;
    await db.query('INSERT INTO enquiries(name,email,message,phone,project_type,budget_range) VALUES($1,$2,$3,$4,$5,$6)',[name,email,message,phone,service.name,budget||'Not specified']);
    const settings=await readSettings();
    await Promise.all([sendBusinessEmail({to:process.env.NOTIFY_EMAIL||settings.support_email,subject:`New quote request: ${service.name}`,text:`${name} (${email}${phone?`, ${phone}`:''}) requested a ${service.name} quote.\nBudget: ${budget||'Not specified'}\nTiming: ${timeline||'Flexible'}\n\n${requirements}`}),sendBusinessEmail({to:email,subject:`We received your ZuTech project brief`,text:`Hello ${name},\n\nWe received your ${service.name} project brief. ${estimate}This range is indicative only. We will review your requirements and reply with a written scope and quotation.\n\nZuTech`})]);
    res.send(page('Quote request received','<section class="inner-hero"><div class="eyebrow">PROJECT BRIEF RECEIVED</div><h1>Thanks for the<br><span>clear brief.</span></h1><p>Your estimate request is with our team. We’ll review the scope and follow up with a written next step.</p><a class="button button-primary" href="/">Back to website</a></section>',settings));
  } catch(error){next(error);}
});

app.get('/consult', async (req,res,next) => {
  try {
    const settings=await readSettings();
    const slots=db?(await db.query("SELECT id,starts_at,ends_at FROM consultation_slots WHERE status='open' AND starts_at>now() ORDER BY starts_at LIMIT 40")).rows:[];
    const options=slots.map(s=>`<option value="${s.id}">${new Date(s.starts_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'})}${s.ends_at?` – ${new Date(s.ends_at).toLocaleTimeString('en-IN',{timeStyle:'short',timeZone:'Asia/Kolkata'})}`:''} IST</option>`).join('');
    const body=`<section class="inner-hero"><div class="eyebrow">A SHORT INTRODUCTORY CALL</div><h1>Let's make the<br><span>next step clear.</span></h1><p>Choose an available time for a project discussion. No payment is needed to book an introductory call.</p></section><section class="quote-section"><form class="quote-form" method="post" action="/consult"><div class="quote-form-heading"><span>BOOK A CONSULTATION</span><span>ABOUT 20 MINUTES</span></div>${slots.length?`<label class="quote-field">Available time<select name="slot_id" required><option value="">Choose a time (India Standard Time)</option>${options}</select></label>`:'<div class="quote-estimate"><strong>No open times right now.</strong><span>Please use the <a href="/contact">project enquiry form</a> and we’ll arrange a time.</span></div>'}<label class="quote-field">Your name<input name="name" maxlength="120" required autocomplete="name"></label><div class="quote-form-row"><label class="quote-field">Email<input type="email" name="email" maxlength="200" required autocomplete="email"></label><label class="quote-field">Phone (optional)<input type="tel" name="phone" maxlength="24" autocomplete="tel"></label></div><label class="quote-field">What would you like to discuss?<textarea name="summary" rows="4" maxlength="1500" required></textarea></label><label class="consent-check"><input type="checkbox" name="privacy_consent" value="yes" required><span>I have read the <a href="/privacy">Privacy Policy</a> and agree to be contacted about this consultation.</span></label><button class="button button-primary" ${slots.length?'':'disabled'}>Request this time ${icon('arrow',16)}</button></form></section>`;
    res.send(page('Book a consultation',body,settings));
  }catch(error){next(error);}
});

app.post('/consult', async (req,res,next) => {
  const slotId=Number(req.body.slot_id),name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim(),phone=String(req.body.phone||'').trim(),summary=String(req.body.summary||'').trim();
  if(!Number.isInteger(slotId)||!name||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||phone.length>24||!summary||summary.length>1500||req.body.privacy_consent!=='yes')return res.status(400).send('Please check your booking details and privacy consent.');
  if(!db)return res.status(503).send('Consultation bookings are temporarily unavailable.');
  const client=await db.connect();
  try {
    await client.query('BEGIN');
    const slot=await client.query("SELECT id,starts_at,ends_at FROM consultation_slots WHERE id=$1 AND status='open' AND starts_at>now() FOR UPDATE",[slotId]);
    if(!slot.rowCount){await client.query('ROLLBACK');const s=await readSettings();return res.status(409).send(page('Time no longer available','<section class="inner-hero"><h1>That time was<br><span>just booked.</span></h1><p>Please choose another open time.</p><a class="button button-primary" href="/consult">See available times</a></section>',s));}
    await client.query('INSERT INTO consultation_bookings(slot_id,name,email,phone,summary) VALUES($1,$2,$3,$4,$5)',[slotId,name,email,phone,summary]);
    await client.query("UPDATE consultation_slots SET status='booked' WHERE id=$1",[slotId]);
    await client.query('COMMIT');
    const settings=await readSettings(),time=new Date(slot.rows[0].starts_at).toLocaleString('en-IN',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Kolkata'})+' IST';
    await Promise.all([sendBusinessEmail({to:process.env.NOTIFY_EMAIL||settings.support_email,subject:'New ZuTech consultation booking',text:`${name} (${email}${phone?`, ${phone}`:''}) booked ${time}.\n\n${summary}`}),sendBusinessEmail({to:email,subject:'Your ZuTech consultation request',text:`Hello ${name},\n\nYour introductory call is booked for ${time}. We’ll contact you if anything needs to be confirmed.\n\nZuTech`})]);
    res.send(page('Consultation requested','<section class="inner-hero"><div class="eyebrow">TIME RESERVED</div><h1>We’ll talk<br><span>soon.</span></h1><p>Your consultation time has been reserved. A confirmation will be sent if email notifications are configured.</p><a class="button button-primary" href="/">Back to website</a></section>',settings));
  }catch(error){await client.query('ROLLBACK').catch(()=>{});next(error);}finally{client.release();}
});

app.get('/work/:id', async (req,res,next) => {
  try {
    const {rows}=await db.query('SELECT * FROM portfolio WHERE id=$1 AND published=true AND is_concept=false',[Number(req.params.id)]);
    if(!rows[0])return res.status(404).send('Case study not found.');
    const item=rows[0],settings=await readSettings();
    const image=safeUrl(item.image_url)?`<img class="case-study-image" src="${esc(safeUrl(item.image_url))}" alt="${esc(item.title)}">`:'';
    const body=`<article class="case-study-page"><section class="inner-hero"><div class="eyebrow">${esc(item.category||'CLIENT CASE STUDY')} / ${esc(item.client_name||'ZU TECH PROJECT')}</div><h1>${esc(item.title)}</h1><p>${esc(item.summary)}</p>${item.client_name?`<p class="business-name-line">Client: <strong>${esc(item.client_name)}</strong></p>`:''}</section>${image}<section class="case-study-details">${item.challenge?`<article><small>THE CHALLENGE</small><h2>What needed to change</h2><p>${esc(item.challenge).replace(/\n/g,'<br>')}</p></article>`:''}${item.approach?`<article><small>OUR APPROACH</small><h2>How we worked</h2><p>${esc(item.approach).replace(/\n/g,'<br>')}</p></article>`:''}${item.outcome?`<article><small>THE OUTCOME</small><h2>What was delivered</h2><p>${esc(item.outcome).replace(/\n/g,'<br>')}</p>${item.result_metric?`<strong class="case-result">${esc(item.result_metric)}</strong>`:''}</article>`:''}<a class="button button-primary" href="/contact">Discuss a similar project ${icon('arrow',16)}</a></section></article>`;
    res.send(page(item.title,body,settings));
  }catch(error){next(error);}
});

app.get('/insights', async (req,res,next) => {
  try {
    const settings=await readSettings(),articles=db?(await db.query('SELECT slug,title,summary,published_at FROM insights WHERE published=true ORDER BY published_at DESC')).rows:[];
    const cards=articles.map(a=>`<a class="insight-teaser-card" href="/insights/${encodeURIComponent(a.slug)}"><small>${publicDate(a.published_at)}</small><h2>${esc(a.title)}</h2><p>${esc(a.summary)}</p><span>Read article ↗</span></a>`).join('')||'<div class="empty-state"><h2>Insights are coming soon.</h2><p>Send us a question through the contact form.</p></div>';
    res.send(page('Insights and field notes',`<section class="inner-hero"><div class="eyebrow">FIELD NOTES / ZUTECH</div><h1>Practical ideas for<br><span>digital work.</span></h1><p>Notes on building useful websites, applications and software.</p></section><section class="insight-list">${cards}</section>`,settings));
  }catch(error){next(error);}
});
app.get('/insights/:slug', async (req,res,next) => {
  try {
    const {rows}=await db.query('SELECT * FROM insights WHERE slug=$1 AND published=true',[String(req.params.slug).slice(0,120)]);
    if(!rows[0])return res.status(404).send('Article not found.');
    const a=rows[0],settings=await readSettings();
    const body=`<article class="insight-article"><section class="inner-hero"><div class="eyebrow">FIELD NOTES / ${publicDate(a.published_at)}</div><h1>${esc(a.title)}</h1><p>${esc(a.summary)}</p></section><div class="insight-article-copy">${esc(a.body).replace(/\n/g,'<br>')}</div><a href="/insights">← All insights</a></article>`;
    res.send(page(a.title,body,settings));
  }catch(error){next(error);}
});

app.get('/proposal/:token', async (req,res,next) => {
  try {
    const {rows}=await db.query("SELECT proposal_no,client_name,title,description,amount_paise,valid_until,terms,status,created_at FROM proposals WHERE share_token=$1 AND status IN ('sent','accepted','declined','expired')",[String(req.params.token).slice(0,80)]);
    if(!rows[0])return res.status(404).send('Proposal link not found or not yet shared.');
    const p=rows[0],settings=await readSettings(),amount=Number(p.amount_paise||0)/100;
    const body=`<article class="shared-proposal"><section class="inner-hero"><div class="eyebrow">PROJECT PROPOSAL / ${esc(p.proposal_no)}</div><h1>${esc(p.title)}</h1><p>Prepared for ${esc(p.client_name)} · ${publicDate(p.created_at)}</p></section><section class="shared-proposal-body"><div class="proposal-status">${esc(p.status.toUpperCase())}${p.valid_until?` · VALID THROUGH ${publicDate(p.valid_until)}`:''}</div><h2>Scope and deliverables</h2><p>${esc(p.description).replace(/\n/g,'<br>')}</p><div class="proposal-total"><span>Proposed project amount</span><strong>₹${amount.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>Any applicable tax and final payment milestones are as stated in the accepted invoice or written agreement.</small></div>${p.terms?`<h2>Terms and next steps</h2><p>${esc(p.terms).replace(/\n/g,'<br>')}</p>`:''}<p class="proposal-support">To discuss this proposal or request a change, contact <a href="/contact">ZuTech customer support</a> and include ${esc(p.proposal_no)}.</p></section></article>`;
    res.send(page(`Proposal ${p.proposal_no}`,body,settings));
  }catch(error){next(error);}
});

app.get('/about', async (req, res, next) => {
  try {
    const settings = await readSettings();
    const about = settings.policy_about || 'ZuTech provides website development, mobile applications, e-commerce services and custom software. Every project begins with a discussion of the customer’s requirements, then a written scope and quotation before work begins.';
    res.send(page('About ZuTech', `<section class="inner-hero"><div class="eyebrow">ABOUT THE BUSINESS</div><h1>Digital work should<br><span>feel clear.</span></h1><p>${esc(about)}</p>${settings.legal_name ? `<p class="business-name-line">Business operated by: <strong>${esc(settings.legal_name)}</strong></p>` : ''}</section><section class="inner-content"><h2>What we do</h2><p>We provide the services listed on this website. The exact deliverables, cost, timeline, payment milestones and support terms are agreed in writing before work begins.</p><div class="inner-callout"><strong>How to start</strong><p>Send your project requirements and receive a written proposal before making a payment.</p><a href="/contact">Discuss a project ${icon('arrow', 16)}</a></div></section>`, settings));
  } catch (error) { next(error); }
});

app.get('/pricing', async (req, res, next) => {
  try {
    const settings = await readSettings();
    const activeServices = db ? (await db.query('SELECT name,summary,price_label,delivery_note FROM services WHERE active=true ORDER BY position,id')).rows : services.map(s=>({name:s.name,summary:s.copy,price_label:'Custom quotation after written scope',delivery_note:''}));
    const cards = activeServices.map((service,index)=>`<article class="pricing-card"><span class="pricing-index">${String(index+1).padStart(2,'0')} / SERVICE</span><h2>${esc(service.name)}</h2><p>${esc(service.summary)}</p><div class="pricing-amount">${esc(service.price_label||'Price confirmed in a written quotation')}</div>${service.delivery_note?`<small class="pricing-delivery">Typical delivery: ${esc(service.delivery_note)}</small>`:''}<a href="/contact">Request a written quote ${icon('arrow',15)}</a></article>`).join('') || '<div class="empty-state"><h2>No services are currently listed.</h2><p>Contact us to discuss a project.</p></div>';
    const body = `<section class="inner-hero pricing-hero"><div class="eyebrow">CLEAR SCOPE. CLEAR PRICE.</div><h1>Pricing that starts<br><span>with your brief.</span></h1><p>Every project has a different scope. We confirm the deliverables, schedule, milestones and total price in a written quotation before you approve or pay.</p></section><section class="pricing-section"><div class="pricing-grid">${cards}</div><div class="pricing-note"><strong>How project pricing works</strong><p>Share your requirements through the enquiry form. We review the work, confirm any applicable taxes and send a written quote. No payment is requested until you approve the service, amount and payment milestones. Final invoice amounts match the accepted quotation.</p><a class="button button-primary" href="/contact">Request a project quote ${icon('arrow',16)}</a></div></section>`;
    res.send(page('Pricing and written quotations', body, settings));
  } catch (error) { next(error); }
});

app.get('/contact', async (req, res, next) => {
  try {
    const settings = await readSettings();
    const activeServices = db ? (await db.query('SELECT name FROM services WHERE active=true ORDER BY position,id')).rows : services.map(s=>({name:s.name}));
    const serviceOptions = activeServices.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
    const contacts = [settings.support_email?`<a href="mailto:${esc(settings.support_email)}">${esc(settings.support_email)}</a>`:'',settings.support_phone?`<a href="tel:${esc(settings.support_phone)}">${esc(settings.support_phone)}</a>`:'',settings.support_hours?`<span>${esc(settings.support_hours)}</span>`:''].filter(Boolean).join('');
    const address = settings.business_address ? `<div class="contact-fact"><small>BUSINESS ADDRESS</small><span>${esc(settings.business_address).replace(/\n/g,'<br>')}</span></div>` : '';
    const profile = `<div class="contact-details">${settings.legal_name?`<div class="contact-fact"><small>BUSINESS NAME</small><span>${esc(settings.legal_name)}</span></div>`:''}${address}${contacts?`<div class="contact-fact"><small>CUSTOMER SUPPORT</small><span class="contact-channels">${contacts}</span></div>`:''}</div>`;
    const body = `<section class="contact-page"><div class="contact-copy"><div class="eyebrow">PROJECT ENQUIRY</div><h1>Start with<br><span>a conversation.</span></h1><p>Tell us what you need. We will review your requirements and reply with questions or a written next step.</p>${profile}<div class="contact-assurance">${icon('check',17)} We use your details to respond to this enquiry.</div></div><form class="contact-form" method="post" action="/contact"><div class="form-title"><span>PROJECT ENQUIRY</span><span>YOUR BRIEF</span></div><label>Your name<input name="name" placeholder="Your full name" required maxlength="120" autocomplete="name"></label><div class="contact-form-row"><label>Email address<input type="email" name="email" placeholder="you@company.com" required maxlength="200" autocomplete="email"></label><label>Phone (optional)<input type="tel" name="phone" placeholder="+91" maxlength="24" autocomplete="tel"></label></div><label>What do you need?<select name="project_type"><option value="">Choose a service (optional)</option>${serviceOptions}<option value="Other / not sure">Other / not sure</option></select></label><label>Project budget (optional)<select name="budget_range"><option value="">Not decided yet</option><option value="Budget available">I have a budget in mind</option><option value="Need guidance">I need help estimating</option></select></label><label>Project requirements<textarea name="message" placeholder="Goals, features, timing or any useful context..." required maxlength="4000"></textarea></label><label class="consent-check"><input type="checkbox" name="privacy_consent" value="yes" required><span>I have read the <a href="/privacy">Privacy Policy</a> and agree to be contacted about this enquiry.</span></label><button class="button button-primary" type="submit">Send enquiry ${icon('arrow',17)}</button><small>Submitting this form does not create a service contract or charge.</small></form></section>`;
    res.send(page('Contact and project enquiries', body, settings));
  } catch (error) { next(error); }
});

app.post('/contact', async (req, res, next) => {
  const name=String(req.body.name||'').trim(), email=String(req.body.email||'').trim(), phone=String(req.body.phone||'').trim(), type=String(req.body.project_type||'').trim(), budget=String(req.body.budget_range||'').trim(), message=String(req.body.message||'').trim();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length>120 || email.length>200 || phone.length>24 || type.length>120 || budget.length>80 || message.length>4000 || req.body.privacy_consent!=='yes') {
    const settings=await readSettings();
    return res.status(400).send(page('Check the enquiry details','<section class="inner-hero"><h1>Please check<br><span>your details.</span></h1><p>Complete the required fields and confirm the privacy notice before submitting.</p><a class="button button-primary" href="/contact">Return to enquiry form</a></section>',settings));
  }
  if (!db) return res.status(503).send('Enquiries are temporarily unavailable. Please try again later.');
  try {
    await db.query('INSERT INTO enquiries(name,email,message,phone,project_type,budget_range) VALUES($1,$2,$3,$4,$5,$6)', [name,email,message,phone,type,budget]);
    const settings=await readSettings();
    await Promise.all([sendBusinessEmail({to:process.env.NOTIFY_EMAIL||settings.support_email,subject:'New ZuTech website enquiry',text:`${name} (${email}${phone?`, ${phone}`:''}) sent a website enquiry.\nService: ${type||'Not specified'}\nBudget: ${budget||'Not specified'}\n\n${message}`}),sendBusinessEmail({to:email,subject:'We received your ZuTech enquiry',text:`Hello ${name},\n\nWe received your project enquiry and will review it before replying with the next step.\n\nZuTech`})]);
    res.send(page('Enquiry received', '<section class="inner-hero"><div class="eyebrow">MESSAGE RECEIVED</div><h1>Thank you for<br><span>getting in touch.</span></h1><p>Your project enquiry has been received. We will review your details and reply using the contact information you provided.</p><a class="button button-primary" href="/">Back to website</a></section>',settings));
  } catch (error) { next(error); }
});

const policyTitles = { privacy: 'Privacy policy', terms: 'Terms & conditions', refund: 'Refund & cancellation policy', delivery: 'Service delivery policy' };
for (const [slug, title] of Object.entries(policyTitles)) app.get(`/${slug}`, async (req, res, next) => {
  try {
    const settings=await readSettings();
    const content=settings[`policy_${slug}`] || `This ${title.toLowerCase()} is being prepared. Contact us before placing an order or making a payment.`;
    res.send(page(title, `<section class="inner-hero legal-page"><div class="eyebrow">${esc(settings.legal_name||settings.display_name||'ZUTECH')} / CUSTOMER INFORMATION</div><h1>${esc(title.split(' ')[0])}<br><span>${esc(title.split(' ').slice(1).join(' '))}</span></h1><div class="policy-copy">${esc(content).replace(/\n/g,'<br>')}</div>${settings.refund_timeline&&slug==='refund'?`<p class="policy-timeline">Approved refunds are initiated within ${esc(settings.refund_timeline)} to the original payment method. Bank or payment provider posting time may vary.</p>`:''}<a href="/contact">Contact customer support ${icon('arrow',16)}</a></section>`,settings));
  } catch (error) { next(error); }
});

app.get('/payments/complete', async (req,res,next) => {
  try {
    const settings=await readSettings();
    res.send(page('Payment status', '<section class="inner-hero"><div class="eyebrow">PAYMENT UPDATE</div><h1>Thank you.<br><span>We are checking.</span></h1><p>Razorpay has returned you to the site. We confirm payment status after receiving the verified payment notification. If you have a question, contact customer support with your invoice reference.</p><a class="button button-primary" href="/contact">Contact support</a></section>',settings));
  } catch(error){next(error);}
});

app.post('/webhooks/razorpay', express.raw({type:'application/json',limit:'1mb'}), async (req,res) => {
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;
  if(!secret||!Buffer.isBuffer(req.body)) return res.status(400).send('Webhook is not configured.');
  const received=Buffer.from(String(req.get('x-razorpay-signature')||''));
  const expected=Buffer.from(crypto.createHmac('sha256',secret).update(req.body).digest('hex'));
  if(received.length!==expected.length||!crypto.timingSafeEqual(received,expected)) return res.status(401).send('Invalid webhook signature.');
  if(!db) return res.status(503).send('Database not configured.');
  try {
    const eventId=String(req.get('x-razorpay-event-id')||'').slice(0,200);
    if(eventId){const inserted=await db.query('INSERT INTO payment_webhook_events(event_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id',[eventId]);if(!inserted.rowCount){const prior=await db.query('SELECT processed_at FROM payment_webhook_events WHERE event_id=$1',[eventId]);if(prior.rows[0]?.processed_at)return res.status(200).json({received:true,duplicate:true});}}
    const body=JSON.parse(req.body.toString('utf8'));
    const entity=body.payload?.payment_link?.entity||{};
    const payment=body.payload?.payment?.entity||{};
    const refund=body.payload?.refund?.entity||{};
    const linkId=String(entity.id||'');
    const statusMap={'payment_link.paid':'paid','payment_link.partially_paid':'partially_paid','payment_link.expired':'expired','payment_link.cancelled':'cancelled'};
    const status=statusMap[body.event];
    if(status&&linkId){const linkPayment=Array.isArray(entity.payments)?entity.payments[0]?.payment_id:null;await db.query('UPDATE invoices SET status=$1,razorpay_payment_id=COALESCE($2,razorpay_payment_id),amount_paid_paise=COALESCE($3,amount_paid_paise),paid_at=CASE WHEN $1=\'paid\' THEN now() ELSE paid_at END,updated_at=now() WHERE razorpay_link_id=$4',[status,payment.id||entity.payment_id||linkPayment||null,Number(entity.amount_paid||payment.amount)||null,linkId]);}
    if(body.event==='refund.processed'||body.event==='refund.failed'){
      const refundId=String(refund.id||'');
      if(refundId){await db.query('UPDATE invoice_refunds SET status=$1,updated_at=now() WHERE refund_id=$2',[body.event==='refund.processed'?'processed':'failed',refundId]);const invoiceResult=await db.query('SELECT invoice_id FROM invoice_refunds WHERE refund_id=$1',[refundId]);if(invoiceResult.rowCount){const invoiceId=invoiceResult.rows[0].invoice_id;const sums=await db.query("SELECT coalesce(sum(amount_paise) FILTER (WHERE status='processed'),0)::bigint AS done,coalesce(sum(amount_paise) FILTER (WHERE status='pending'),0)::bigint AS pending FROM invoice_refunds WHERE invoice_id=$1",[invoiceId]);const invoice=await db.query('SELECT amount_paid_paise FROM invoices WHERE id=$1',[invoiceId]);const paid=Number(invoice.rows[0]?.amount_paid_paise||0),done=Number(sums.rows[0].done||0),pending=Number(sums.rows[0].pending||0);const next=done>=paid&&paid>0?'refunded':pending?'refund_pending':done?'partially_refunded':'paid';await db.query('UPDATE invoices SET status=$1,updated_at=now() WHERE id=$2',[next,invoiceId]);}}
    }
    if(eventId) await db.query('UPDATE payment_webhook_events SET processed_at=now() WHERE event_id=$1',[eventId]);
    res.status(200).json({received:true});
  } catch(error){console.error('Razorpay webhook processing failed:',error.message);res.status(400).send('Invalid webhook payload.');}
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function start() {
  if (db) {
    await db.query(`CREATE TABLE IF NOT EXISTS enquiries(
      id bigserial PRIMARY KEY,name text NOT NULL,email text NOT NULL,message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),phone text NOT NULL DEFAULT '',project_type text NOT NULL DEFAULT '',
      budget_range text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'new',admin_note text NOT NULL DEFAULT ''
    )`);
    for (const [column, definition] of Object.entries({ phone:"text NOT NULL DEFAULT ''", project_type:"text NOT NULL DEFAULT ''", budget_range:"text NOT NULL DEFAULT ''", status:"text NOT NULL DEFAULT 'new'", admin_note:"text NOT NULL DEFAULT ''" })) {
      await db.query(`ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    }
    await db.query("UPDATE enquiries SET status='new' WHERE status IS NULL OR status=''");
    await db.query(`CREATE TABLE IF NOT EXISTS site_settings(key text PRIMARY KEY,value text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`);
    await db.query(`CREATE TABLE IF NOT EXISTS services(
      id bigserial PRIMARY KEY,name text NOT NULL,summary text NOT NULL,price_label text NOT NULL DEFAULT '',
      price_min_paise bigint NOT NULL DEFAULT 0,price_max_paise bigint NOT NULL DEFAULT 0,
      delivery_note text NOT NULL DEFAULT '',active boolean NOT NULL DEFAULT true,position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query("ALTER TABLE services ADD COLUMN IF NOT EXISTS price_min_paise bigint NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS price_max_paise bigint NOT NULL DEFAULT 0");
    await db.query(`CREATE TABLE IF NOT EXISTS portfolio(
      id bigserial PRIMARY KEY,title text NOT NULL,category text NOT NULL DEFAULT '',client_name text NOT NULL DEFAULT '',
      summary text NOT NULL,image_url text NOT NULL DEFAULT '',project_url text NOT NULL DEFAULT '',is_concept boolean NOT NULL DEFAULT true,
      challenge text NOT NULL DEFAULT '',approach text NOT NULL DEFAULT '',outcome text NOT NULL DEFAULT '',result_metric text NOT NULL DEFAULT '',
      published boolean NOT NULL DEFAULT false,position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query("ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS challenge text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS approach text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS result_metric text NOT NULL DEFAULT ''");
    await db.query(`CREATE TABLE IF NOT EXISTS testimonials(
      id bigserial PRIMARY KEY,customer_name text NOT NULL,role text NOT NULL DEFAULT '',company text NOT NULL DEFAULT '',
      quote text NOT NULL,rating integer NOT NULL DEFAULT 5,published boolean NOT NULL DEFAULT false,position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS insights(
      id bigserial PRIMARY KEY,slug text NOT NULL UNIQUE,title text NOT NULL,summary text NOT NULL,body text NOT NULL,
      published boolean NOT NULL DEFAULT false,published_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS consultation_slots(
      id bigserial PRIMARY KEY,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(starts_at)
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS consultation_bookings(
      id bigserial PRIMARY KEY,slot_id bigint NOT NULL UNIQUE REFERENCES consultation_slots(id),name text NOT NULL,email text NOT NULL,
      phone text NOT NULL DEFAULT '',summary text NOT NULL,status text NOT NULL DEFAULT 'booked',created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS proposals(
      id bigserial PRIMARY KEY,proposal_no text NOT NULL,share_token text NOT NULL UNIQUE,client_name text NOT NULL,client_email text NOT NULL,
      title text NOT NULL,description text NOT NULL,amount_paise bigint NOT NULL,valid_until date,terms text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'draft',sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS admin_audit_logs(
      id bigserial PRIMARY KEY,admin_name text NOT NULL DEFAULT 'admin',action text NOT NULL,entity text NOT NULL DEFAULT '',entity_id text NOT NULL DEFAULT '',
      details text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS invoices(
      id bigserial PRIMARY KEY,invoice_no text NOT NULL,client_name text NOT NULL,client_email text NOT NULL,
      client_phone text NOT NULL DEFAULT '',description text NOT NULL,amount_paise bigint NOT NULL,amount_paid_paise bigint NOT NULL DEFAULT 0,
      taxable_amount_paise bigint NOT NULL DEFAULT 0,tax_rate_bps integer NOT NULL DEFAULT 0,tax_amount_paise bigint NOT NULL DEFAULT 0,
      sac_code text NOT NULL DEFAULT '',place_of_supply text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'draft',razorpay_link_id text UNIQUE,payment_url text NOT NULL DEFAULT '',razorpay_payment_id text NOT NULL DEFAULT '',
      expires_at timestamptz,paid_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxable_amount_paise bigint NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS tax_amount_paise bigint NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS sac_code text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS place_of_supply text NOT NULL DEFAULT ''");
    await db.query(`CREATE TABLE IF NOT EXISTS invoice_refunds(
      id bigserial PRIMARY KEY,invoice_id bigint NOT NULL REFERENCES invoices(id),refund_id text NOT NULL UNIQUE,
      amount_paise bigint NOT NULL,status text NOT NULL DEFAULT 'pending',receipt text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS payment_webhook_events(event_id text PRIMARY KEY,received_at timestamptz NOT NULL DEFAULT now(),processed_at timestamptz)`);
    const defaults = {
      legal_name: '', display_name: 'ZuTech', business_address: '', support_email: process.env.SUPPORT_EMAIL || '',
      support_phone: process.env.SUPPORT_PHONE || '', support_hours: '', gstin: '', website_url: process.env.PUBLIC_BASE_URL || '',
      refund_timeline: '', profile_confirmed: 'false', policies_confirmed: 'false',
      policy_about: 'ZuTech provides website development, mobile application, e-commerce and custom software services. Each engagement begins with a review of customer requirements. The deliverables, quotation, delivery schedule and payment milestones are agreed in writing before work begins.',
      policy_terms: 'A project begins only after the customer approves a written proposal describing the services, deliverables, fees, payment milestones and expected schedule. The customer is responsible for providing accurate content, access and feedback required for the agreed work. Changes outside the approved scope may require a revised quotation and schedule. Sending an enquiry alone does not create a service contract.',
      policy_privacy: 'When you submit an enquiry, we collect your name, email address, optional phone number, project selection, budget preference and message so we can review and respond to your request. We use enquiry details to communicate about the requested services and, if you engage us, to administer the project. We do not sell enquiry information. Payment details are collected and processed by the payment provider; we do not store card or UPI credentials. You may request access to or correction of your enquiry data by contacting customer support. We retain records only as needed for the enquiry, service relationship and applicable record-keeping requirements.',
      policy_refund: 'Before accepting any payment, the written project proposal will state the cancellation conditions and which completed work or approved costs are payable. To request cancellation or a refund, contact customer support with your invoice reference. Any refund due will be initiated to the original payment method within the processing period stated in this policy after the request is reviewed and approved. Bank or payment-provider posting time may vary. Contact us if the refund has not appeared after that period.',
      policy_delivery: 'The written project proposal states the deliverables, milestones and expected delivery schedule for each engagement. Work starts after the proposal is accepted and required access, materials and initial payment (if applicable) are received. Digital deliverables are shared electronically. If a schedule changes, we will discuss the revised timeline with the customer.',
      policy_contact: 'For a project or service query, use the contact information displayed on the Contact page. Include your project or invoice reference when asking about an existing engagement or payment.'
    };
    for (const [key,value] of Object.entries(defaults)) await db.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING',[key,value]);
    const { rows: count } = await db.query('SELECT count(*)::int AS count FROM services');
    if (!count[0].count) for (let index=0; index<services.length; index++) { const s=services[index]; await db.query('INSERT INTO services(name,summary,price_label,position) VALUES($1,$2,$3,$4)',[s.name,s.copy,'Custom quotation after written scope',index]); }
    await db.query('CREATE INDEX IF NOT EXISTS enquiries_created_idx ON enquiries(created_at DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS invoices_created_idx ON invoices(created_at DESC)');
  }
  app.listen(process.env.PORT || 3000, '0.0.0.0');
}
start().catch(error => { console.error(error.message); process.exit(1); });
