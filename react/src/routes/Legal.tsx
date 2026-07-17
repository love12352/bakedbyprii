import { useParams } from 'react-router-dom';
import { LEGAL_DOCS } from '../content/legalDocs';

export default function Legal() {
  const { doc = '' } = useParams();
  const data = LEGAL_DOCS[doc];
  if (!data) return <h2 className="sheet-title">Not found</h2>;
  return (
    <article className="sheet-panel legal">
      <span className="sheet-eyebrow">{data.eyebrow}</span>
      <h2 className="sheet-title">{data.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
    </article>
  );
}
