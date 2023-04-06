import { createSignal } from "solid-js";
import type { JSX } from "solid-js";

import Tabs from "./Tabs";

export interface TabsAndContentProps {
  defaultValue: string;
  sections: Record<string, JSX.Element>;
}

export default function TabsAndContent(props: TabsAndContentProps) {
  const [getValue, setValue] = createSignal(props.defaultValue);

  return (
    <>
      <Tabs
        currentValue={getValue()}
        defaultValue={props.defaultValue}
        onValueChange={setValue}
        labels={Object.keys(props.sections)}
      />
      {props.sections[getValue()]}
    </>
  );
}
