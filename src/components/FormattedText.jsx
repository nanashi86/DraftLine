import { parseInline, segmentStyle, segments } from '../lib/formatting.js';

/** Text with its inline marks (bold, italic, underline, strikethrough) as styled spans. */
export default function FormattedText({ text, marks, className, as: Tag = 'div', ...rest }) {
  return (
    <Tag className={className} {...rest}>
      {segments(text, marks).map((sg, k) => {
        const style = segmentStyle(sg);
        return style ? <span key={k} style={style}>{sg.text}</span> : sg.text;
      })}
    </Tag>
  );
}

/** A title-page field typed with Markdown emphasis (**bold**, *italic*, _underline_, ~~strike~~). */
export function RichLine({ text, ...rest }) {
  const { text: plain, marks } = parseInline(text);
  return <FormattedText as="span" text={plain} marks={marks} {...rest} />;
}
