// Illustrations contain no photographs or real identities. Private seeded
// avatar media takes priority; this palette is used only for fictional users.
const palettes = [
  { background: "#F8E9DE", shirt: "#AA536B", skin: "#D69C7A", hair: "#44353E" },
  { background: "#EFEBF5", shirt: "#7D729A", skin: "#C88966", hair: "#3B323D" },
  { background: "#E7EEE7", shirt: "#65806D", skin: "#B77E60", hair: "#493C39" },
  { background: "#F7E6E9", shirt: "#BD7D64", skin: "#E0AF8D", hair: "#59413C" },
];

export function demoPalette(id?: string) {
  const hash = [...(id || "demo")].reduce(
    (value, char) => value + char.charCodeAt(0),
    0,
  );
  return palettes[hash % palettes.length];
}
