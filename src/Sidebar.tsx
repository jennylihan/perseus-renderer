import * as React from "react";

export type SidebarEntry = {label?: string};

type Props = {
    entries: SidebarEntry[];
    // Returns the card element for an item index, so the sidebar can scroll
    // to it and track which one is in view.
    getCard: (index: number) => HTMLElement | null;
};

// A fixed left-hand list of every loaded item. Clicking an entry scrolls its
// card into view; the entry whose card is nearest the top of the viewport is
// highlighted as you scroll. Hidden on narrow screens where it would crowd
// the grid.
export function Sidebar({entries, getCard}: Props): React.ReactElement | null {
    const [active, setActive] = React.useState(0);

    React.useEffect(() => {
        setActive(0);
    }, [entries]);

    React.useEffect(() => {
        const onScroll = () => {
            let best = 0;
            for (let i = 0; i < entries.length; i++) {
                const card = getCard(i);
                if (card && card.getBoundingClientRect().top <= 120) {
                    best = i;
                }
            }
            setActive(best);
        };
        window.addEventListener("scroll", onScroll, {passive: true});
        return () => window.removeEventListener("scroll", onScroll);
    }, [entries, getCard]);

    if (entries.length === 0) {
        return null;
    }

    return (
        <nav className="sidebar" aria-label="Items">
            <h3>Items</h3>
            {entries.map((entry, i) => (
                <a
                    key={i}
                    href={`#item-${i + 1}`}
                    className={i === active ? "active" : undefined}
                    onClick={(e) => {
                        e.preventDefault();
                        getCard(i)?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                        });
                        setActive(i);
                    }}
                >
                    Item {i + 1}
                    {entry.label && (
                        <span className="sidebar-label"> · {entry.label}</span>
                    )}
                </a>
            ))}
        </nav>
    );
}
