import { ArrowUpRight, Globe, Mail, MapPin, Phone, Youtube, Instagram, Facebook } from "lucide-react";

// Original 400 × 400 institutional logo, not a screenshot crop.
const logo = "/jamia-footer-logo.svg";
const numbers = [
  ["+91 88918 38472", "+918891838472"],
  ["+91 94943 13786", "+919494313786"],
  ["+91 62351 39072", "+916235139072"],
] as const;
const official = "https://jamiaimamnavavi-ra.com/";
const email = "info@jamiaimamnavavi-ra.com";

export function JamiaFooter() {
  return (
    <footer className="jamia-site-footer" aria-label="Jamia Imam Navavi institutional information" lang="en" dir="ltr">
      <div className="jamia-footer-inner">
        <section aria-labelledby="jamia-footer-about">
          <h2 id="jamia-footer-about">About Us</h2>
          <a href={official} target="_blank" rel="noopener noreferrer" className="jamia-footer-logo-link" aria-label="Jamia Imam Navavi official website">
            <img className="jamia-footer-logo" src={logo} width="288" height="288" alt="JAMIA IMAM NAVAVI (RA) logo" loading="lazy" decoding="async" />
          </a>
          <h3>JAMIA IMAM NAVAVI (RA)</h3>
          <p className="jamia-footer-subtitle">Advanced Study and Research Centre and Public Charitable Trust</p>
          <p className="jamia-footer-description">Bridging traditional Islamic knowledge and modern technology, with a commitment to faith, education and innovation.</p>
          <a className="jamia-footer-website" href={official} target="_blank" rel="noopener noreferrer"><Globe aria-hidden="true" size={18} /> <span>Official Website</span><ArrowUpRight aria-hidden="true" size={15}/></a>
        </section>
        <section aria-labelledby="jamia-footer-contact">
          <h2 id="jamia-footer-contact">Stay in Touch</h2>
          <address className="jamia-footer-contact">
            <div className="jamia-footer-contact-row">
              <Phone aria-hidden="true" size={19}/>
              <div>{numbers.map(([label, number]) => <a key={number} href={"tel:" + number} dir="ltr">{label}</a>)}</div>
            </div>
            <div className="jamia-footer-contact-row"><Mail aria-hidden="true" size={19}/><a href={"mailto:" + email}>{email}</a></div>
            <div className="jamia-footer-contact-row"><MapPin aria-hidden="true" size={19}/><div><span>Venmenad, Pavaratty P.O.</span><span>Thrissur, Kerala, India</span><span>PIN: 680507</span></div></div>
          </address>
          <div className="jamia-footer-social" aria-label="Social media">
            <a href="https://www.google.com/search?q=site%3Ainstagram.com+%22Jamia+Imam+Navavi%22" target="_blank" rel="noopener noreferrer" aria-label="Find Jamia on Instagram" title="Find Jamia on Instagram"><Instagram size={20} aria-hidden="true"/></a>
            <a href="https://www.google.com/search?q=site%3Afacebook.com+%22Jamia+Imam+Navavi%22" target="_blank" rel="noopener noreferrer" aria-label="Find Jamia on Facebook" title="Find Jamia on Facebook"><Facebook size={20} aria-hidden="true"/></a>
            <a href="https://www.youtube.com/watch?v=v5wCCYadXIw" target="_blank" rel="noopener noreferrer" aria-label="Jamia Imam Navavi on YouTube" title="Jamia Imam Navavi on YouTube"><Youtube size={20} aria-hidden="true"/></a>
          </div>
        </section>
      </div>
    </footer>
  );
}
