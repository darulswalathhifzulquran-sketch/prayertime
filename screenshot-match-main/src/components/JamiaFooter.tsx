import { ArrowUpRight, Globe, Mail, MapPin, Phone, Youtube, Instagram, Facebook } from "lucide-react";

// Exact logo crop from the institution's supplied footer reference.
const logo = "data:image/webp;base64,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";
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
            <img className="jamia-footer-logo" src={logo} width="120" height="116" alt="JAMIA IMAM NAVAVI (RA) logo" loading="lazy" decoding="async" />
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
