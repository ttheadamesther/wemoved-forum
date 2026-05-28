import { C } from '../lib/constants'

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32 }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${C.accentDk}` }}>{title}</h2>
    <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.8 }}>{children}</div>
  </div>
)

const P = ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>

export default function LegalPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 6 }}>Mentions légales & Confidentialité</h1>
      <p style={{ fontSize: 12, color: C.textDim, marginBottom: 40 }}>Dernière mise à jour : mai 2026</p>

      {/* ── MENTIONS LÉGALES ── */}
      <Section title="1. Mentions légales">
        <P><strong>Éditeur du site :</strong> Anthony Bocquez</P>
        <P><strong>Site :</strong> wemoved-forum.vercel.app</P>
        <P><strong>Hébergeur :</strong> Vercel Inc. — 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis — <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: C.accentTxt }}>vercel.com</a></P>
        <P><strong>Contact :</strong> Via le formulaire de signalement disponible sur le site (page "Signaler un bug").</P>
      </Section>

      {/* ── DONNÉES COLLECTÉES ── */}
      <Section title="2. Données personnelles collectées">
        <P>Dans le cadre de l'utilisation de WeMoved, les données suivantes peuvent être collectées :</P>
        <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
          {[
            'Adresse e-mail (lors de l\'inscription)',
            'Pseudo choisi par l\'utilisateur',
            'Informations de profil optionnelles : âge, sexe, ville, département, région, situation amoureuse, bio, centres d\'intérêt',
            'Photos de profil et bannière uploadées volontairement',
            'Contenus publiés : messages du forum, messages privés, votes',
            'Données de connexion : date de dernière connexion, statut en ligne',
          ].map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{item}</li>)}
        </ul>
        <P>Les informations de profil (hors email) sont <strong>entièrement optionnelles</strong> et visibles par les autres membres connectés.</P>
      </Section>

      {/* ── FINALITÉS ── */}
      <Section title="3. Finalité du traitement">
        <P>Les données collectées sont utilisées exclusivement pour :</P>
        <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
          {[
            'Créer et gérer votre compte utilisateur',
            'Afficher votre profil public aux autres membres',
            'Permettre les interactions sur le forum (posts, réponses, votes, messages privés)',
            'Assurer la modération et la sécurité de la communauté',
            'Gérer le système de niveaux et de récompenses (XP, badges)',
          ].map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{item}</li>)}
        </ul>
        <P>Aucune donnée n'est vendue, partagée ou transmise à des tiers à des fins commerciales.</P>
      </Section>

      {/* ── BASE LÉGALE ── */}
      <Section title="4. Base légale (RGPD)">
        <P>Le traitement de vos données repose sur votre <strong>consentement</strong>, exprimé lors de la création de votre compte. Vous pouvez retirer ce consentement à tout moment en demandant la suppression de votre compte.</P>
      </Section>

      {/* ── CONSERVATION ── */}
      <Section title="5. Durée de conservation">
        <P>Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos données personnelles sont effacées dans un délai raisonnable. Les contenus publiés (posts, réponses) peuvent être anonymisés plutôt que supprimés afin de préserver la cohérence des discussions.</P>
      </Section>

      {/* ── DROITS ── */}
      <Section title="6. Vos droits (RGPD)">
        <P>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</P>
        <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
          {[
            'Droit d\'accès à vos données',
            'Droit de rectification (modifiable depuis votre profil)',
            'Droit à l\'effacement ("droit à l\'oubli")',
            'Droit à la portabilité de vos données',
            'Droit d\'opposition au traitement',
          ].map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{item}</li>)}
        </ul>
        <P>Pour exercer ces droits, utilisez le formulaire de contact disponible sur le site. Toute demande sera traitée dans un délai de 30 jours.</P>
      </Section>

      {/* ── COOKIES ── */}
      <Section title="7. Cookies et stockage local">
        <P>WeMoved utilise le <strong>stockage local du navigateur</strong> (localStorage) uniquement pour maintenir votre session de connexion. Aucun cookie de tracking ou publicitaire n'est utilisé.</P>
      </Section>

      {/* ── HÉBERGEMENT ── */}
      <Section title="8. Sécurité et hébergement">
        <P>Les données sont stockées sur <strong>Supabase</strong> (infrastructure PostgreSQL sécurisée) et le site est hébergé sur <strong>Vercel</strong>. Les communications sont chiffrées via HTTPS. Malgré les mesures de sécurité mises en place, aucun système n'est infaillible — nous vous recommandons de ne pas partager d'informations sensibles dans vos messages.</P>
      </Section>

      {/* ── CGU ── */}
      <Section title="9. Règles d'utilisation (CGU)">
        <P>En utilisant WeMoved, vous acceptez de respecter les règles suivantes :</P>
        <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
          {[
            'Ne pas publier de contenu illégal, haineux, discriminatoire ou à caractère pornographique',
            'Ne pas harceler, menacer ou insulter d\'autres membres',
            'Ne pas usurper l\'identité d\'une autre personne',
            'Ne pas spammer ou publier de la publicité non sollicitée',
            'Respecter la vie privée des autres membres',
            'Ne pas partager les informations privées d\'autrui sans son consentement',
          ].map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{item}</li>)}
        </ul>
        <P>Tout manquement à ces règles peut entraîner la suspension ou la suppression définitive du compte, sans préavis.</P>
        <P>L'éditeur se réserve le droit de modérer, masquer ou supprimer tout contenu jugé inapproprié, et de bannir tout utilisateur ne respectant pas ces règles.</P>
      </Section>

      {/* ── RESPONSABILITÉ ── */}
      <Section title="10. Limitation de responsabilité">
        <P>WeMoved est une plateforme communautaire. L'éditeur ne peut être tenu responsable des contenus publiés par les utilisateurs. Les opinions exprimées sur le forum sont celles de leurs auteurs et n'engagent pas l'éditeur du site.</P>
        <P>L'éditeur se réserve le droit de modifier les présentes mentions légales à tout moment. Les utilisateurs seront informés des changements significatifs.</P>
      </Section>

      <div style={{ marginTop: 40, padding: '16px 20px', background: `${C.accentDk}15`, border: `1px solid ${C.accentDk}40`, borderRadius: 12, fontSize: 12, color: C.textMid }}>
        Pour toute question relative à vos données personnelles ou au fonctionnement du site, rendez-vous sur la page <strong>Signaler un bug</strong> via le menu de votre profil.
      </div>
    </div>
  )
}