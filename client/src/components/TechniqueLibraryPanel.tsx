import { TechniqueEditor, type TechniqueEditorProps } from "./TechniqueEditor";

export function TechniqueLibraryPanel(props: TechniqueEditorProps) {
  return <div className="technique-library-shell"><TechniqueEditor {...props} /></div>;
}
