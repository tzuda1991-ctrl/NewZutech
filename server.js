const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false } })
  : null;

app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(express.static('public'));

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
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

const page = (title, body, active = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f7f8fc"><meta name="description" content="ZuTech is a digital development studio creating websites, mobile applications, e-commerce experiences and custom software."><title>${esc(title)} | ZuTech</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/style.css"></head>
<body><header class="site-header"><a class="brand" href="/" aria-label="ZuTech home"><span class="brand-mark">Z</span><span class="brand-name">zu<span>tech</span><small> DIGITAL STUDIO</small></span></a><button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false"><span></span><span></span></button><nav class="main-nav"><a class="${active === 'services' ? 'active' : ''}" href="/#services">Services</a><a href="/#approach">Our approach</a><a href="/about">About</a><a class="nav-cta" href="/contact">Let's talk ${icon('arrow', 16)}</a></nav></header><main>${body}</main>
<footer class="site-footer"><div class="footer-top"><a class="brand brand-light" href="/"><span class="brand-mark">Z</span><span class="brand-name">zu<span>tech</span><small> DIGITAL STUDIO</small></span></a><p>Thoughtful digital work<br>for ambitious businesses.</p><a class="footer-contact" href="/contact">Start a conversation ${icon('arrow', 16)}</a></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ZuTech. All rights reserved.</span><div class="footer-links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refund">Refunds</a><a href="/delivery">Delivery</a><a href="/contact">Contact</a></div></div></footer>
<script>const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.main-nav');toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.setAttribute('aria-label',open?'Open navigation':'Close navigation');nav.classList.toggle('is-open',!open)});nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('is-open');toggle?.setAttribute('aria-expanded','false')}));</script></body></html>`;

app.get('/', (req, res) => res.send(page('Digital studio for what is next', `
<section class="hero"><div class="hero-grid"></div><div class="hero-copy"><div class="eyebrow"><span class="eyebrow-dot"></span> DIGITAL DESIGN & DEVELOPMENT</div><h1>Good ideas deserve<br><span>a great</span> digital life.</h1><p class="hero-lede">We design and build clear, capable digital experiences that help businesses move forward.</p><div class="hero-actions"><a class="button button-primary" href="/contact">Tell us what you're building ${icon('arrow', 17)}</a><a class="text-link" href="#services">Explore what we do <span>↓</span></a></div><div class="hero-note"><span class="note-line"></span> A considered approach, from first conversation to launch.</div></div><div class="hero-art" aria-label="Digital design preview"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-star">✳</div><div class="art-panel"><div class="panel-top"><span class="panel-brand"><i></i> studio / 01</span><span class="panel-menu">•••</span></div><div class="panel-content"><span class="panel-label">A digital studio</span><strong>Make room<br>for <em>what's next.</em></strong><div class="panel-rule"></div><span class="panel-sub">Strategy · Design · Technology</span></div><div class="panel-footer"><span>DESIGNING WITH INTENT</span><span>↗</span></div></div><div class="float-card float-card-top"><span class="float-icon">${icon('spark', 17)}</span><span><b>Built around you</b><small>Made for your next step</small></span></div><div class="float-card float-card-bottom"><span class="status-dot"></span><span><b>Thoughtfully made</b><small>From idea to launch</small></span></div></div><a class="scroll-cue" href="#services"><span>SCROLL TO EXPLORE</span><i>↓</i></a></section>
<section class="intro-band"><p>ONE STUDIO. THE RIGHT PEOPLE.<br><strong>Digital work with purpose.</strong></p><div class="intro-detail">From the first sketch to the final detail, we bring thoughtful design and dependable technology together.</div></section>
<section class="services-section" id="services"><div class="section-heading"><div><div class="eyebrow">WHAT WE CAN DO</div><h2>Make your next move<br><span>your best one.</span></h2></div><p>Whether you are starting fresh or ready to improve what you have, we shape the right digital solution around your goals.</p></div><div class="service-grid">${services.map(s => `<article class="service-card"><div class="service-card-top"><span class="service-icon">${icon(s.icon, 23)}</span><span class="service-kicker">${s.kicker}</span></div><h3>${s.name}</h3><p>${s.copy}</p><a href="/contact" aria-label="Ask about ${esc(s.name)}">Discuss this service <span>↗</span></a></article>`).join('')}</div></section>
<section class="approach-section" id="approach"><div class="approach-intro"><div class="eyebrow eyebrow-light">A BETTER WAY TO BUILD</div><h2>Clear thinking.<br><span>Careful making.</span></h2><p>Good work comes from understanding the real need, agreeing on a clear scope and staying thoughtful through every stage.</p><a href="/about" class="button button-outline">Get to know us ${icon('arrow', 16)}</a></div><div class="steps">${[['01','Listen','We learn about your business, goals and the people you serve.'],['02','Shape','We agree on priorities, scope and a practical plan of work.'],['03','Build','We design and develop with regular updates and clear communication.'],['04','Launch','We prepare your deliverables and help you take the next step.']].map(([n,t,d]) => `<article class="step"><span class="step-number">${n}</span><div><h3>${t}</h3><p>${d}</p></div><span class="step-check">${icon('check', 17)}</span></article>`).join('')}</div></section>
<section class="promise-section"><div class="promise-mark">${icon('spark', 27)}</div><div><div class="eyebrow">THE ZUTECH DIFFERENCE</div><h2>Built with care.<br><span>Made to make sense.</span></h2></div><p>We believe digital work should be useful, well considered and easy to understand. You will know what is being built, what comes next and what your project includes.</p></section>
<section class="contact-cta"><div class="cta-decoration">✳</div><div class="eyebrow eyebrow-light">HAVE SOMETHING IN MIND?</div><h2>Let's make it<br><span>happen.</span></h2><p>Tell us a little about your idea. We will get back to you to talk through the next step.</p><a class="button button-white" href="/contact">Start a project ${icon('arrow', 17)}</a><div class="cta-footnote">No pressure. Just a good first conversation.</div></section>
`)));

app.get('/about', (req, res) => res.send(page('About our studio', `<section class="inner-hero"><div class="eyebrow">A LITTLE ABOUT US</div><h1>Digital work should<br><span>feel clear.</span></h1><p>ZuTech is a digital development studio helping businesses turn ideas into useful online experiences. We bring design, engineering and straightforward communication together from the start.</p></section><section class="inner-content"><h2>Our way of working</h2><p>Every project begins with a conversation about your needs, audience and priorities. We define the scope and agree on a quotation and timeline before work begins. Throughout the project, we share progress and keep the next steps clear.</p><div class="inner-callout"><strong>What we make</strong><p>Websites, mobile applications, e-commerce experiences and custom software—built around an agreed brief.</p><a href="/contact">Share your project ${icon('arrow', 16)}</a></div></section>`)));

app.get('/contact', (req, res) => res.send(page('Start a project', `<section class="contact-page"><div class="contact-copy"><div class="eyebrow">LET'S TALK</div><h1>Start with<br><span>a conversation.</span></h1><p>Share a little about what you have in mind. We will review your requirements and get back to you about a suitable next step.</p>${process.env.SUPPORT_EMAIL ? `<a class="contact-email" href="mailto:${esc(process.env.SUPPORT_EMAIL)}">${esc(process.env.SUPPORT_EMAIL)} ${icon('arrow', 16)}</a>` : ''}<div class="contact-assurance">${icon('check', 17)} Your enquiry is only used to respond to your request.</div></div><form class="contact-form" method="post"><div class="form-title"><span>PROJECT ENQUIRY</span><span>01 — 03</span></div><label>Your name<input name="name" placeholder="How should we address you?" required maxlength="120" autocomplete="name"></label><label>Email address<input type="email" name="email" placeholder="you@company.com" required maxlength="200" autocomplete="email"></label><label>Tell us about your project<textarea name="message" placeholder="A few details about the idea, goals or features you have in mind..." required maxlength="4000"></textarea></label><button class="button button-primary" type="submit">Send project enquiry ${icon('arrow', 17)}</button><small>By submitting, you agree to our <a href="/privacy">Privacy Policy</a>.</small></form></section>`)));

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (![name, email, message].every(value => typeof value === 'string' && value.trim()) || name.length > 120 || email.length > 200 || message.length > 4000 || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).send(page('Check your details', '<section class="inner-hero"><h1>Please check<br><span>your details.</span></h1><p>Make sure each field is complete and your email address is valid.</p><a class="button button-primary" href="/contact">Return to enquiry form</a></section>'));
  if (!db) return res.status(503).send(page('Enquiries unavailable', '<section class="inner-hero"><h1>Enquiry form<br><span>temporarily unavailable.</span></h1><p>Please try again later.</p><a class="button button-primary" href="/contact">Return to contact</a></section>'));
  try {
    await db.query('INSERT INTO enquiries(name,email,message) VALUES($1,$2,$3)', [name.trim(), email.trim(), message.trim()]);
    res.send(page('Thank you', '<section class="inner-hero"><div class="eyebrow">MESSAGE RECEIVED</div><h1>Thanks for<br><span>getting in touch.</span></h1><p>Your project enquiry has been recorded. We will review the details and follow up using the email address you provided.</p><a class="button button-primary" href="/">Back to home</a></section>'));
  } catch (error) {
    console.error('Could not save enquiry:', error.message);
    res.status(503).send(page('Enquiry unavailable', '<section class="inner-hero"><h1>We could not save<br><span>your enquiry.</span></h1><p>Please try again later.</p><a class="button button-primary" href="/contact">Try again</a></section>'));
  }
});

const policies = {
  privacy: 'We collect the name, email address and project requirements you submit so we can respond to your enquiry. Enquiry records are stored in the site database. Contact us to request access to or correction of information you submitted. Payment details are handled by the payment provider when applicable.',
  terms: 'Development services are provided under a written quotation that describes the agreed scope, timeline and payment schedule. Sending an enquiry does not confirm a project. Work begins after the terms are agreed in writing.',
  refund: 'Cancellation and refund eligibility depends on the written project agreement, work completed and applicable law. Any project-specific refund terms are provided in the quotation before payment.',
  delivery: 'Digital deliverables, milestones and delivery timelines are agreed in writing before work begins. Deliverables are shared electronically unless otherwise agreed.'
};
for (const [slug, text] of Object.entries(policies)) app.get(`/${slug}`, (req, res) => res.send(page(`${slug[0].toUpperCase()}${slug.slice(1)} policy`, `<section class="inner-hero legal-page"><div class="eyebrow">ZUTECH / INFORMATION</div><h1>${slug[0].toUpperCase()}${slug.slice(1)}<br><span>policy.</span></h1><p>${text}</p><a href="/contact">Contact ZuTech ${icon('arrow', 16)}</a></section>`)));

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/admin', async (req, res) => {
  const expected = process.env.ADMIN_PASSWORD;
  const supplied = Buffer.from((req.headers.authorization || '').replace(/^Basic /, ''), 'base64').toString();
  const givenBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(`admin:${expected || ''}`);
  if (!expected || givenBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(givenBytes, expectedBytes)) {
    res.set('WWW-Authenticate', 'Basic realm="ZuTech Admin"');
    return res.status(401).send('Authentication required');
  }
  if (!db) return res.status(503).send('Database not configured');
  try {
    const { rows } = await db.query('SELECT * FROM enquiries ORDER BY id DESC LIMIT 200');
    const list = rows.length ? rows.map(row => `<article class="admin-enquiry"><div class="eyebrow">ENQUIRY #${esc(row.id)}</div><h3>${esc(row.name)}</h3><a href="mailto:${esc(row.email)}">${esc(row.email)}</a><p>${esc(row.message)}</p><small>${esc(row.created_at)}</small></article>`).join('') : '<p>No enquiries yet.</p>';
    res.set('Cache-Control', 'no-store').send(page('Project enquiries', `<section class="inner-content admin-page"><div class="eyebrow">ZUTECH / ADMIN</div><h1>Project enquiries</h1>${list}</section>`));
  } catch (error) {
    res.status(503).send('Database unavailable');
  }
});

async function start() {
  if (db) await db.query('CREATE TABLE IF NOT EXISTS enquiries(id bigserial PRIMARY KEY,name text NOT NULL,email text NOT NULL,message text NOT NULL,created_at timestamptz DEFAULT now())');
  app.listen(process.env.PORT || 3000, '0.0.0.0');
}
start().catch(error => { console.error(error.message); process.exit(1); });
