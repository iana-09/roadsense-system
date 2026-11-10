import { createElement, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Database, Layers3, Linkedin, MapPinned, Menu, Route, ScanSearch, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import './home.css';

const team = [
  { name: 'Nadine Love Ramos', role: 'Project Manager', description: 'Guides the vision, coordination, and delivery of RoadSense.', photo: '/images/team/nadine.jpg', icon: Users, linkedin: 'https://www.linkedin.com/in/nadine-ramos01/' },
  { name: 'Philip Sebastian D. Peñaranda', role: 'Lead Developer', description: 'Builds the core platform and connects its moving parts.', photo: '/images/team/philip.png', icon: Layers3, linkedin: 'https://www.linkedin.com/in/philip-sebatian-pe%C3%B1aranda-83215a405/' },
  { name: 'Iana Kim R. Aflleje', role: 'UI Designer / Frontend Developer', description: 'Shapes clear experiences across the platform.', photo: '/images/team/iana.jpg', icon: Sparkles, linkedin: 'https://www.linkedin.com/in/iana-kim-aflleje-4b306b277/' },
  { name: 'Sofia Beatrice Alexa R. Reyes', role: 'Database Developer', description: 'Organizes the road data behind maps and analysis.', photo: '/images/team/sofia.jpg', icon: Database, linkedin: 'https://www.linkedin.com/in/sofia-beatrice-alexa-reyes-1b3b75380/' },
];

const processSteps = [
  { title: 'Detect', description: 'Road imagery is analyzed to identify possible potholes and surface issues.', detail: 'RoadSense analyzes road imagery to find possible potholes and other surface issues. Detected areas are highlighted so teams can review the visual evidence.', icon: ScanSearch, images: [{ src: '/images/workflow/detect.png', alt: 'Road image with two possible potholes highlighted by the detection system', width: 1042, height: 867 }] },
  { title: 'Verify', description: 'Local government teams review detections before they appear on the public map.', detail: 'Local government reviewers examine each detection with its location, confidence, and original road image before deciding whether it should appear as a verified public hazard.', icon: ShieldCheck, images: [{ src: '/images/workflow/verify-map.png', alt: 'Hazard map showing a pothole review panel with verification controls', width: 1185, height: 677 }, { src: '/images/workflow/verify-frame.png', alt: 'Original road frame showing a detected major pothole' }] },
  { title: 'Understand', description: 'Explore hazard locations and road health views to guide follow-up work.', detail: 'Maps, route-level road health, and detection records help teams understand where hazards are concentrated and plan follow-up work.', icon: BarChart3, images: [{ src: '/images/workflow/understand-map.png', alt: 'Public map showing clusters of road hazards', width: 1567, height: 631 }, { src: '/images/workflow/understand-health.png', alt: 'Road health dashboard showing route scores and hazard summaries' }, { src: '/images/workflow/understand-detections.png', alt: 'Road detection table with hazard types, severity, and status' }] },
];

function Brand() {
  return <a className="home-brand" href="#top" aria-label="RoadSense home"><span className="home-brand-mark"><img src="/roadsense.png" alt="" /></span><strong>RoadSense</strong></a>;
}

export default function Home() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const closeButtonRef = useRef(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  const openDetail = (type, index) => {
    previousFocusRef.current = document.activeElement;
    setSlideIndex(0);
    setDetail({ type, index });
  };

  useEffect(() => {
    if (!detail) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDetail(null);
      if (detail.type === 'process' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const count = processSteps[detail.index].images.length;
        setSlideIndex((current) => (current + (event.key === 'ArrowRight' ? 1 : -1) + count) % count);
      }
      if (event.key === 'Tab') {
        const focusable = [...modalRef.current.querySelectorAll('button, a[href]')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [detail]);

  return <div className="home-page" id="top">
    <header className="home-header"><div className="home-shell home-header-inner">
      <Brand />
      <nav className={`home-nav${menuOpen ? ' home-nav-open' : ''}`} aria-label="Main navigation">
        <a href="#about" onClick={() => setMenuOpen(false)}>About us</a>
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        <a href="#team" onClick={() => setMenuOpen(false)}>The team</a>
        <button className="home-mobile-login" onClick={() => navigate('/login')}>Sign in</button>
      </nav>
      <div className="home-header-actions"><button className="home-text-button" onClick={() => navigate('/login')}>Sign in</button><button className="home-header-cta" onClick={() => navigate('/guest-dashboard?view=map')}>Explore map <ArrowUpRight size={17} /></button><button className="home-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div>
    </div></header>

    <main>
      <section className="home-hero home-shell" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="home-hero-heading">
            <span className="home-hero-mark"><img src="/roadsense.png" alt="" /></span>
            <h1 id="home-title">Better roads begin with <em>better insight.</em></h1>
          </div>
          <div className="home-hero-support">
            <p>RoadSense turns road hazard detections into a clear picture of street conditions, helping communities and local government teams see what needs attention.</p>
            <div className="home-hero-actions"><button className="home-button-primary" onClick={() => navigate('/guest-dashboard?view=map')}>Explore the public map <ArrowRight size={18} /></button><a className="home-button-secondary" href="#about">Discover RoadSense <ArrowUpRight size={17} /></a></div>
            <div className="home-hero-note"><ShieldCheck size={17} /> Public map shows verified road hazards</div>
          </div>
        </div>
        <div className="home-hero-showcase" aria-label="RoadSense web and mobile previews">
          <figure className="home-showcase-figure home-showcase-map">
            <div className="home-showcase-map-image"><img src="/images/hero/web-map.png" alt="RoadSense public hazard map showing road issues around Imus, Dasmariñas, and nearby cities" width="1507" height="668" fetchPriority="high" /></div>
            <figcaption className="home-showcase-caption"><span>WEB MAP</span><p>See verified hazards in context.</p></figcaption>
          </figure>
          <figure className="home-showcase-figure home-showcase-mobile">
            <div className="home-showcase-phones" role="img" aria-label="Two original RoadSense iPhone previews showing the mobile dashboard and hazard map"><span className="home-phone-crop home-phone-left" /><span className="home-phone-crop home-phone-right" /></div>
            <figcaption className="home-showcase-caption"><span>MOBILE APP</span><p>Road insight on the move.</p></figcaption>
          </figure>
        </div>
      </section>

      <div className="home-bridge home-shell"><span>BUILT FOR CLEARER DECISIONS</span><div><ShieldCheck size={18} /> Verified hazards</div><div><Route size={18} /> Road health analysis</div><div><BarChart3 size={18} /> Useful reporting</div></div>

      <section className="home-about home-section home-shell" id="about"><div className="home-section-heading"><span className="home-kicker">01 / ABOUT US</span><h2>Technology with a clearer purpose.</h2></div><div className="home-about-grid"><div className="home-about-main"><div className="home-about-symbol"><img src="/roadsense.png" alt="RoadSense logo" /></div><p>RoadSense is a road distress detection and monitoring platform designed to help local governments understand road conditions and prioritize maintenance. It brings hazard detections, map views, and road health analysis into one place.</p><a href="#how-it-works">See how it works <ArrowUpRight size={17} /></a></div><div className="home-about-side"><span><MapPinned size={26} /></span><h3>From detection to direction</h3><p>Location-aware reports make road issues easier to review, verify, and act on.</p><div /><small>Designed for safer communities and more informed road management.</small></div></div></section>

      <section className="home-process home-section" id="how-it-works" aria-labelledby="home-process-title"><div className="home-shell"><div className="home-section-heading"><span className="home-kicker">02 / HOW IT WORKS</span><h2 id="home-process-title">Road data that leads to action.</h2><p>A connected workflow helps turn visual road evidence into information that teams can use.</p></div><ol className="home-process-grid">{processSteps.map(({ title, description, icon, images }, index) => {
        const thumbnail = images[0];
        return <li className="home-process-item" key={title}><button className="home-process-card" onClick={() => openDetail('process', index)} aria-label={`Explore step ${index + 1}: ${title}`}>
          <span className="home-process-media">{thumbnail ? <img src={thumbnail.src} alt={thumbnail.alt} width={thumbnail.width} height={thumbnail.height} loading="lazy" decoding="async" /> : <span className="home-process-placeholder">Image coming soon</span>}<span className="home-process-number">{String(index + 1).padStart(2, '0')}</span></span>
          <span className="home-process-content"><span className="home-process-icon">{createElement(icon, { size: 25, 'aria-hidden': true })}</span><span className="home-process-title">{title}</span><span className="home-process-description">{description}</span><span className="home-process-action">Explore step <span className="home-process-arrow"><ArrowUpRight size={16} aria-hidden="true" /></span></span></span>
        </button></li>;
      })}</ol></div></section>

      <section className="home-team home-section home-shell" id="team" aria-labelledby="home-team-title">
        <div className="home-team-intro"><div className="home-section-heading"><span className="home-kicker">03 / NOVA TEAM</span><h2 id="home-team-title">People behind the platform.</h2></div><p>RoadSense is brought together by a team working across planning, software, interface design, and data. Meet the roles shaping the project.</p></div>
        <ul className="home-team-grid">{team.map(({ name, role, description, photo, linkedin }, index) => <li key={name}>
          <a className="home-team-card" href={linkedin} onClick={(event) => { event.preventDefault(); openDetail('team', index); }} aria-label={`View profile of ${name}`}>
            <div className="home-team-avatar"><div className="home-team-photo"><img src={photo} alt={`Portrait of ${name}`} width="800" height="800" loading="lazy" /></div></div>
            <span className="home-team-index">{String(index + 1).padStart(2, '0')}</span>
            <h3>{name}</h3><p className="home-team-role">{role}</p><p className="home-team-description">{description}</p>
            <span className="home-team-action">View profile <ArrowUpRight size={16} aria-hidden="true" /></span>
          </a>
        </li>)}</ul>
      </section>

      <section className="home-cta-section home-shell"><div className="home-cta-panel"><div><span className="home-kicker">EXPLORE ROADSENSE</span><h2>A clearer picture of the road starts here.</h2><p>Browse verified hazards as a guest, or sign in to work with your local government dashboard.</p></div><div className="home-cta-actions"><button className="home-button-primary" onClick={() => navigate('/guest-dashboard')}>Explore public view <ArrowRight size={18} /></button><button className="home-button-secondary" onClick={() => navigate('/login')}>Sign in <ArrowUpRight size={17} /></button></div></div></section>
    </main>

    <footer className="home-footer"><div className="home-shell home-footer-inner"><Brand /><span>© {new Date().getFullYear()} RoadSense. Built by Nova.</span><a href="#top">Back to top ↑</a></div></footer>
    {detail && (() => {
      const item = detail.type === 'process' ? processSteps[detail.index] : team[detail.index];
      const Icon = item.icon;
      if (detail.type === 'process') {
        const image = item.images[slideIndex];
        const showNavigation = item.images.length > 1;
        return <div className="home-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
          <section ref={modalRef} className="home-lightbox" role="dialog" aria-modal="true" aria-labelledby="home-modal-title">
            <div className="home-lightbox-stage">
              <img src={image.src} alt={image.alt} />
              {showNavigation && <>
                <button className="home-lightbox-arrow home-lightbox-prev" onClick={() => setSlideIndex((current) => (current - 1 + item.images.length) % item.images.length)} aria-label={`Previous ${item.title} image`}><ArrowLeft size={22} /></button>
                <button className="home-lightbox-arrow home-lightbox-next" onClick={() => setSlideIndex((current) => (current + 1) % item.images.length)} aria-label={`Next ${item.title} image`}><ArrowRight size={22} /></button>
                <span className="home-lightbox-count" aria-live="polite">{slideIndex + 1} / {item.images.length}</span>
              </>}
            </div>
            <aside className="home-lightbox-info">
              <div className="home-lightbox-heading"><span className="home-modal-icon"><Icon size={23} /></span><div><span className="home-kicker">HOW IT WORKS / 0{detail.index + 1}</span><h2 id="home-modal-title">{item.title}</h2></div></div>
              <p>{item.detail}</p>
            </aside>
            <button ref={closeButtonRef} className="home-lightbox-close" onClick={() => setDetail(null)} aria-label="Close details"><X size={22} /></button>
          </section>
        </div>;
      }
      return <div className="home-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
        <section ref={modalRef} className="home-modal" role="dialog" aria-modal="true" aria-labelledby="home-modal-title">
          <header className="home-modal-header">
            <span className="home-modal-icon"><Icon size={23} /></span>
            <div><span className="home-kicker">NOVA TEAM / 0{detail.index + 1}</span><h2 id="home-modal-title">{item.name}</h2><small>{item.role}</small></div>
            <button ref={closeButtonRef} className="home-modal-close" onClick={() => setDetail(null)} aria-label="Close details"><X size={21} /></button>
          </header>
          <div className="home-modal-body">
            <p>{item.description}</p>
            <div className="home-modal-profile"><div className="home-modal-profile-photo"><img src={item.photo} alt={item.name} /></div><span>More about {item.name}'s contributions will be added here.</span></div>
            <a className="home-modal-linkedin" href={item.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`View ${item.name} on LinkedIn`}><Linkedin size={18} /> View LinkedIn profile <ArrowUpRight size={16} /></a>
          </div>
        </section>
      </div>;
    })()}
  </div>;
}
