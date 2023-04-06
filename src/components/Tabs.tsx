import { Tabs } from "@kobalte/core";
import { For } from "solid-js";

import styles from "./Tabs.module.css";

export interface TabsProps {
  currentValue: string;
  defaultValue: string;
  onValueChange: (value: string) => void;
  labels: string[];
}

export default function (props: TabsProps) {
  return (
    <Tabs.Root
      class={styles.root}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
    >
      <Tabs.List>
        <For each={props.labels}>
          {(label) => (
            <Tabs.Trigger
              class={label === props.currentValue ? styles.current : undefined}
              value={label}
            >
              {label}
            </Tabs.Trigger>
          )}
        </For>
        <Tabs.Indicator />
      </Tabs.List>
    </Tabs.Root>
  );
}
