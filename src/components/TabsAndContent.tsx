import { createSignal } from "solid-js";
import type { JSX } from "solid-js";

import Tabs from "./Tabs";

export interface TabsContentSection {
  contents: JSX.Element;
  label: string;
}

export interface TabsAndContentProps {
  defaultValue: string;
  sections: Record<string, JSX.Element>;
}

export default function TabsAndContent(props: TabsAndContentProps) {
  const [getValue, setValue] = createSignal(props.defaultValue);
  // (ryan is gonna yell at me if he sees this because it should be value)

  return (
    <>
      <Tabs
        defaultValue={props.defaultValue}
        onValueChange={setValue}
        labels={Object.keys(props.sections)}
      />
      {props.sections[getValue()]}
    </>
  );
}
