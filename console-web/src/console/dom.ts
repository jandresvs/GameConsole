type Child = Node | string;

/** Crea un elemento con clase y contenido. Evita innerHTML: todo texto entra como texto. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}
