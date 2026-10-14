"""Remove the repeated Freebird story paragraph from the About page files given (html + RSC .txt), in place.
Same cut as redesign-roast.sh; the lot-facts paragraph ("Freebird is the only SKU on the bar ...") stays."""
import sys
S = "Freebird is the only bean on the bar. This sack came from Chiang Mai, Thailand — one lot at a time, roasted to the Kaffelogic profile and roast level you pick, then packed as whole beans. When the sack is gone, a new origin lands."
cut = ['<p class="leading-relaxed text-foreground/80">' + S + '</p>',
       ',["$","p",null,{"className":"leading-relaxed text-foreground/80","children":"' + S + '"}]',
       ',[\\"$\\",\\"p\\",null,{\\"className\\":\\"leading-relaxed text-foreground/80\\",\\"children\\":\\"' + S + '\\"}]']
for f in sys.argv[1:]:
    t = open(f, encoding='utf-8').read(); n = sum(t.count(c) for c in cut)
    for c in cut: t = t.replace(c, '')
    assert n >= 1 and S not in t, f"{f}: story still there"
    open(f, 'w', encoding='utf-8').write(t)
