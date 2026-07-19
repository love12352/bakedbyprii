import { useParams } from 'react-router-dom';
import { LEGAL_DOCS } from '../content/legalDocs';

export default function Legal() {
  const { doc = '' } = useParams();
  // An own-property check, not a bare lookup: `doc` comes from the URL, and
  // /legal/constructor would otherwise return a truthy prototype member and
  // render an empty panel. (Object.hasOwn is ES2022; this project targets ES2021.)
  const data = Object.prototype.hasOwnProperty.call(LEGAL_DOCS, doc) ? LEGAL_DOCS[doc] : undefined;
  if (!data) return <h2 className="sheet-title">Not found</h2>;
  return (
    <article className="sheet-panel legal">
      <span className="sheet-eyebrow">{data.eyebrow}</span>
      <h2 className="sheet-title">{data.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
    </article>
  );
}
