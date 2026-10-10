import icons from "../../design-system/icons/icons.json";

export type IconName = keyof typeof icons;

const SYM = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"';
const sprite = Object.entries(icons)
  .map(([n, body]) => `<symbol id="i-${n}" viewBox="0 0 24 24" ${SYM}>${body}</symbol>`)
  .join("");

/** The icon sprite (club grammar: 24px, 1.6 stroke, square caps). Render once. */
export function Sprite() {
  return <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }} dangerouslySetInnerHTML={{ __html: sprite }} />;
}

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`i ${className}`} width={size} height={size} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}
