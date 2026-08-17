// Globale JSX-Typen fuer IDE-Kompatibilitaet (aeltere TypeScript-Versionen < 5.1)
// @types/react 18.3 nutzt GlobalJSXIntrinsicElements, aeltere IDEs brauchen JSX.IntrinsicElements
declare namespace JSX {
  interface Element extends globalThis.React.ReactElement<any, any> {}
  interface ElementClass extends globalThis.React.Component<any> {
    render(): globalThis.React.ReactNode
  }
  interface ElementAttributesProperty {
    props: {}
  }
  interface ElementChildrenAttribute {
    children: {}
  }
  interface IntrinsicElements extends GlobalJSXIntrinsicElements {}
  interface IntrinsicAttributes extends GlobalJSXIntrinsicAttributes {}
}
