import type { JSX } from "solid-js";
import { createSignal } from "solid-js";

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
				onChange={(newValue) => {
					console.log({ newValue });
					setValue(newValue);
				}}
				tabs={Object.entries(props.sections).map(([title]) => ({
					info: title,
					title,
				}))}
			/>
			{props.sections[getValue()]}
		</>
	);
}
