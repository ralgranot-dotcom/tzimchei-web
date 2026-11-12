import json, os, sys
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
ph = lambda n: [{"u": f"https://example.org/{n}/original.jpg", "c": "צלם", "l": "CC BY 4.0", "s": "https://example.org"}]
nov = [0]*10 + [9, 0]
plants = [
 {"k": 1, "sci": "Ceratonia siliqua", "auth": "L.", "fam": "Fabaceae", "gen": "Ceratonia", "he": "חרוב מצוי", "en": "Carob", "alt": [], "life": "tree", "grp": "tree", "nat": "native", "syn": [], "reg": {"samaria": 50, "carmel": 20}, "bloom": nov, "bsrc": "inat", "col": ["red"], "txt": "עץ ירוק עד.", "wp": "https://he.wikipedia.org/wiki/x", "fi": "", "ph": ph(1)},
 {"k": 2, "sci": "Retama raetam", "auth": "", "fam": "Fabaceae", "gen": "Retama", "he": "רותם המדבר", "en": "", "alt": [], "life": "", "grp": "shrub", "nat": "native", "syn": [], "reg": {"negev": 40}, "bloom": [], "bsrc": "", "col": [], "txt": "", "wp": "", "fi": "", "ph": []},
 {"k": 3, "sci": "Salvia fruticosa", "auth": "", "fam": "Lamiaceae", "gen": "Salvia", "he": "מרווה משולשת", "en": "", "alt": [], "life": "", "grp": "shrub", "nat": "native", "syn": [], "reg": {"samaria": 30}, "bloom": [], "bsrc": "", "col": ["purple"], "txt": "", "wp": "", "fi": "", "ph": ph(3)},
 {"k": 4, "sci": "Nerium oleander", "auth": "", "fam": "Apocynaceae", "gen": "Nerium", "he": "הרדוף הנחלים", "en": "", "alt": [], "life": "", "grp": "shrub", "nat": "native", "syn": [], "reg": {"samaria": 20}, "bloom": [0,0,0,1,5,9,9,5,1,0,0,0], "bsrc": "inat", "col": ["pink"], "txt": "", "wp": "", "fi": "", "ph": ph(4)},
 {"k": 5, "sci": "Anemone coronaria", "auth": "", "fam": "Ranunculaceae", "gen": "Anemone", "he": "כלנית מצויה", "en": "", "alt": [], "life": "", "grp": "perennial", "nat": "native", "syn": [], "reg": {"samaria": 9}, "bloom": [9,9,5,0,0,0,0,0,0,0,3,9], "bsrc": "inat", "col": ["red"], "txt": "", "wp": "", "fi": "", "ph": ph(5)},
]
regions = [{"id": "samaria", "he": "הרי השומרון", "poly": [[35.0,32.5],[35.0,32.1],[35.42,32.1],[35.45,32.45]]}, {"id": "negev", "he": "הנגב", "poly": [[34.3,31.3],[35.2,31.3],[35.0,30.4],[34.5,30.6]]}, {"id": "carmel", "he": "הכרמל", "poly": [[34.93,32.85],[34.93,32.6],[35.12,32.57],[35.08,32.78]]}]
w = lambda n, o: json.dump(o, open(os.path.join(out, n), "w"), ensure_ascii=False)
w("plants.json", {"generated": "2026-11-09", "regions": regions, "families": {"Fabaceae": "קטניות"}, "parts": 2})
w("plants-0.json", plants[:3]); w("plants-1.json", plants[3:])
w("toxic.json", [{"k": 4, "sev": "high", "parts": ["עלים"], "sym": "הקאות", "prin": "oleandrin", "pet": "", "q": [], "skin": False, "pets": ["dog"], "fruit": False, "child": True, "allergy": False, "src": [["NC State", "https://plants.ces.ncsu.edu"]]}])
month = {"sow": ["שום"], "plant": ["חסה"], "tasks": {"ornamental": ["להשקות"], "vegetables": ["לחפות"]}}
w("garden.json", {"months": [month]*12, "groups": {"herbs": {"months": [3], "note": "שותלים באביב."}}, "natural": ["חיפוי קרקע"], "moag": "https://www.gov.il/x.pdf",
  "items": [{"id": 0, "he": "מרווה רפואית", "sci": "Salvia officinalis", "cat": "herb", "sow": [], "plant": [2], "gen": "herbs", "sun": ["שמש מלאה"], "soil": [], "drain": [], "ph": [], "prop": [], "size": "", "care": ["טיפול"], "key": 0, "photos": [], "src": [["ncsu", "https://plants.ces.ncsu.edu"]]},
            {"id": 1, "he": "עגבנייה", "sci": "Solanum lycopersicum", "cat": "veg", "sow": [3], "plant": [3, 11], "gen": "", "sun": [], "soil": [], "drain": [], "ph": [], "prop": [], "size": "", "care": [], "key": 0, "photos": [], "src": []}]})
w("grow.json", {"1": {"gen": "herbs", "sun": ["שמש מלאה"], "soil": [], "drain": [], "prop": [], "size": "", "care": ["להשקות מעט"], "sl": "ceratonia-siliqua"}})
w("guide.json", {"intro": "מבוא", "basics": ["כלים נקיים"], "mistakes": ["ייבוש"], "hormone_photo": [], "methods": [{"id": "softwood", "title": "ייחור רך", "when": "באביב", "good_for": "חרצית", "steps": ["חתכו"], "after": "השקו", "src": [], "photos": [], "sources": [["UC", "https://ucanr.edu"]]}]})
w("edible.json", [{"k": 1, "gid": -1, "he": "חרוב מצוי", "sci": "Ceratonia siliqua", "rate": "green", "why": [], "parts": ["תרמילים"], "cook": "no", "uses": "", "warn": "", "quote": [], "toxparts": [], "look": [], "nut": None, "src": [["USDA", "https://fdc.nal.usda.gov"]]}])
w("medicinal.json", [{"k": 2, "gid": -1, "he": "רותם המדבר", "sci": "Retama raetam", "level": "D", "history": "שימוש עממי", "studied": [], "active": "", "side": [], "inter": [], "caut": [], "trad": ["ק"], "ema": [], "src": [["ויקיפדיה", "https://he.wikipedia.org"]]}])
w("rambam.json", {"intro": ["רבי משה בן מימון"], "limits": ["חלקי"], "works": ["משנה תורה"], "rules": [{"h": 1, "n": "אוכלים רק כשרעבים", "t": "לא אוכלים אלא ברעב", "u": "https://www.sefaria.org"}],
  "foods": [{"he": "תאנים", "sci": "Ficus carica", "key": 0, "gid": -1, "v": "good", "t": "טובות לעולם", "q": "", "refs": [{"t": "הלכות דעות", "u": "https://www.sefaria.org"}], "note": ""}, {"he": "חרובים", "sci": "Ceratonia siliqua", "key": 1, "gid": -1, "v": "avoid", "t": "רעים לעולם", "q": "", "refs": [{"t": "הלכות דעות", "u": "https://www.sefaria.org"}], "note": ""}],
  "gloss": [{"n": 3, "he": "לענה", "ar": "Ifsintin", "sci": "Artemisia absinthium", "key": 0, "gid": -1, "c": "sure", "syn": ["x"], "mai": "", "mey": "הערה"}], "sources": [{"t": "Max Meyerhof", "u": "https://wellcomecollection.org"}]})
care = {"sun": ["שמש מלאה"], "soil": [], "ph": [], "drain": [], "prop": [], "h": "1.0", "w": "", "leaf": "", "rate": "", "maint": "", "fl": [], "bl": [], "frost": 99, "poi": "", "poip": [], "res": ["יובש"], "th": [], "u": "https://plants.ces.ncsu.edu"}
w("nursery.json", {"plants": [{"he": "אבוטילון דו-גוני", "fam": "חלמיתיים", "form": "שיח", "cat": "shrub", "hy": False, "cv": False, "c": 0, "key": 0, "gid": -1, "ph": 0, "b": "Abutilon megapotamicum"}],
  "care": [care], "guide": {"shrub": ["גיזום"]}, "photos": [[{"u": "https://example.org/a/medium.jpg", "c": "צלם", "l": "CC0", "s": "https://example.org", "y": 2026}]]})
