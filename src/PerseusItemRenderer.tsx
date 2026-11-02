import {
    KeypadContext,
    StatefulKeypadContextProvider,
} from "@khanacademy/keypad-context";
import {MobileKeypad} from "@khanacademy/math-input";
import {
    PerseusI18nContextProvider,
    ServerItemRenderer,
} from "@khanacademy/perseus";
import {mockStrings} from "@khanacademy/perseus/strings";
import * as React from "react";

import {dependenciesV2} from "./perseus-deps";

import type {PerseusItem} from "@khanacademy/perseus-core";

type Props = {
    item: PerseusItem;
    // Whether the correct answer is revealed when the item first renders.
    showAnswer: boolean;
    // Bumped by the parent on each new render to force a fresh renderer.
    renderKey: number;
};

export function PerseusItemRenderer({
    item,
    showAnswer,
    renderKey,
}: Props): React.ReactElement {
    const [answerShown, setAnswerShown] = React.useState(showAnswer);

    // Reset to the item's configured default whenever a new item is rendered.
    React.useEffect(() => {
        setAnswerShown(showAnswer);
    }, [renderKey, showAnswer]);

    const showSolutions = answerShown ? "all" : "none";

    return (
        <PerseusI18nContextProvider strings={mockStrings} locale="en">
        <StatefulKeypadContextProvider>
            <KeypadContext.Consumer>
                {({keypadElement, setKeypadElement, renderer}) => (
                    <div>
                        <div className="framework-perseus">
                            <ServerItemRenderer
                                key={renderKey}
                                problemNum={0}
                                item={item}
                                dependencies={dependenciesV2}
                                apiOptions={{
                                    isMobile: false,
                                    showSolutions,
                                }}
                                keypadElement={keypadElement}
                                showSolutions={showSolutions}
                            />
                        </div>

                        <div className="controls">
                            <button
                                type="button"
                                className="btn"
                                onClick={() => setAnswerShown((s) => !s)}
                            >
                                {answerShown ? "Hide answer" : "Show answer"}
                            </button>
                        </div>

                        <MobileKeypad
                            onElementMounted={setKeypadElement}
                            onDismiss={() => renderer?.blur()}
                            onAnalyticsEvent={async () => {}}
                        />
                    </div>
                )}
            </KeypadContext.Consumer>
        </StatefulKeypadContextProvider>
        </PerseusI18nContextProvider>
    );
}
