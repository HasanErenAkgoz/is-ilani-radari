# İş İlanı Radarı

> **English summary.** A Claude desktop app scheduled task that runs the
> [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search) `/scrape` skill
> for several candidates, one after another, on weekdays at 09:00 and 17:00. Each
> candidate has their own clone of the framework with their own CV-based profile.
> Postings are scored High/Medium/Low against that profile. Only new High/Medium
> postings that were never sent before get emailed, through the Gmail connector,
> to that candidate alone. Empty or "no jobs" emails are never sent. A sent-log
> kept outside the repos prevents re-sends. The package also adds two Turkish
> job-portal skills, **Kariyer.net** and **Youthall**. Docs below are in Turkish.

▶️ **[Tanıtım videosunu izle (40 sn)](assets/tanitim.mp4)**

## Ne yapar?

- **Zamanlanmış tarama:** Claude masaüstü uygulamasında hafta içi her gün 09:00 ve 17:00'de çalışır (cron `0 9,17 * * 1-5`). Elle tetiklenirse hafta sonu kendini durdurur.
- **Çok aday, sırayla:** `people.json` içindeki her kişi için kendi ai-job-search klonunda `/scrape` (job-scraper) çalıştırır. Biri bitmeden diğerine geçmez, bir kişinin hatası diğerlerini durdurmaz.
- **CV'ye göre puanlama:** Her ilan o kişinin profiline (CLAUDE.md, değerlendirme kuralları) göre High / Medium / Low olarak değerlendirilir. İsterseniz `notes` alanıyla kişiye özel konum, deneyim ve dil kuralları eklersiniz.
- **Yalnızca yeni ve uygun ilanlar:** Maile sadece bu çalıştırmada yeni eklenen, daha önce o kişiye gönderilmemiş High/Medium ilanlar girer.
- **Boş mail yok:** Uygun ilan yoksa mail gönderilmez. "İlan yok", özet ya da hata maili de atılmaz.
- **Tekrar gönderim engeli:** Gönderilen ilanlar repo dışındaki bir gönderim kaydına (`sent_<key>.json`) yazılır. Aynı ilan başka portalda ya da yeniden yayınlansa bile ikinci kez gönderilmez.
- **Düzenli e-posta:** Konu satırında tarih, Sabah/Akşam, ilan sayısı ve yüksek uyum sayısı yer alır. Gövde bir HTML tablodur: uyum, pozisyon, şirket, konum, son başvuru, link. Her ilanın altında kısa bir gerekçe ve ⚠ uyarılar bulunur. Recruiter ve ekip için LinkedIn arama linkleri ve gerekirse portal sağlık notu da eklenir.
- **Türk portalları:** `kariyernet-search` (Kariyer.net) ve `youthall-search` (Youthall) portal skill'leri upstream'deki LinkedIn/Jobindex portallarıyla aynı yapıdadır: Bun CLI, testler, `enabled:` bayrağı.
- **Güvenlik sınırı:** İlan metinleri güvenilmeyen veri sayılır. İçlerindeki talimatlara uyulmaz, başvuru yapılmaz, form doldurulmaz, listedeki adresler dışında kimseye mesaj atılmaz.

## Gereksinimler

- **Claude masaüstü uygulaması**, zamanlanmış görevler (scheduled tasks) özelliğiyle. Görev sadece uygulama açıkken ve bilgisayar uyanıkken çalışır.
- Claude uygulamasında bağlı bir **Gmail bağlayıcısı** (mailler bu hesaptan gönderilir).
- **[Bun](https://bun.sh)**: portal CLI'leri için (`curl -fsSL https://bun.sh/install | bash`).
- **Python 3.10 veya üstü.** Upstream'in `tools/*.py` betikleri 3.10'dan eski sürümlerde çalışmaz. macOS'taki sistem `python3` 3.9 olabilir. Öyleyse yeni bir Python kurun ve kurulumda `--python` ile gösterin.
- `git` ve bash (macOS'taki bash 3.2 yeterli).

## Kurulum

### 1. Her aday için upstream'i klonlayın

Her aday kendi profilini taşıdığı için her biri ayrı bir klon ister:

```bash
mkdir -p ~/Projeler && cd ~/Projeler
git clone https://github.com/ai-job-search-dev/ai-job-search.git ai-job-search-deniz
git clone https://github.com/ai-job-search-dev/ai-job-search.git ai-job-search-ece
```

> Kişisel verileriniz bu klonlardaki takip edilen dosyalara yazılır. Klonu herkese açık bir fork'a **push etmeyin**. Upstream'in SETUP.md dosyasındaki "private repository" önerisine bakın.

### 2. Bu paketi indirin ve Türk portallarını ekleyin

```bash
git clone <bu-deponun-adresi> is-ilani-radari
cd is-ilani-radari
./install.sh --permissions ~/Projeler/ai-job-search-deniz ~/Projeler/ai-job-search-ece
```

`install.sh` şunları yapar:

- `portals/kariyernet-search` ve `portals/youthall-search` klasörlerini her klonun `.agents/skills/` klasörüne kopyalar. `/scrape` portalları buradan kendisi bulur, ayrıca kayıt gerekmez.
- `--permissions` verilirse iki portalın `bun run` iznini klonun `.claude/settings.json` "allow" listesine ve `tools/security_guards.py` içindeki `ALLOWED_PERMISSIONS` kümesine ekler. Upstream bu iki listenin birebir eşleşmesini denetler. Gözetimsiz görevin izin sormadan çalışması için bu adım gerekir. İsterseniz bu iki satırı elle de ekleyebilirsiniz.
- Var olan dosyaların üzerine yazmaz. Tekrar çalıştırmak güvenlidir. Üzerine yazmak için `--force`, önizleme için `--dry-run` kullanın.

Ardından her klonda upstream'in bağımlılık kurulumunu çalıştırın. Bu iki portalın çalışma zamanı bağımlılığı yok; adım yalnızca TypeScript tiplerini kurar:

```bash
cd ~/Projeler/ai-job-search-deniz && python3 tools/install_portal_clis.py
```

**Bir portalı kapatmak için** o klondaki `.agents/skills/<portal>/SKILL.md` dosyasının başlığında `enabled: false` yazın. Portal kurulu kalır ama `/scrape` onu atlar.

### 3. Her adayın profilini doldurun

Her klonda Claude Code'u açıp upstream'in kurulum görüşmesini çalıştırın:

```bash
cd ~/Projeler/ai-job-search-deniz
claude
# sonra: /setup
```

`/setup` CV'yi okur ve şu dosyaları doldurur: `CLAUDE.md` (aday profili), `.claude/skills/job-application-assistant/` altındaki profil dosyaları (`01-candidate-profile.md`, `04-job-evaluation.md` ve diğerleri) ile `.claude/skills/job-scraper/search-queries.md` (arama terimleri). Türkiye'de arama için `search-queries.md` dosyasına Türkçe düz terimler ekleyin (ör. `yazılım geliştirici`, `dış ticaret uzmanı`). Konum kurallarını da `04-job-evaluation.md` dosyasında ayarlayın.

Kurulumu doğrulamak için her klonda bir kez elle `/scrape` çalıştırmanız iyi olur.

### 4. Kişi listesini düzenleyin

```bash
./install.sh --config
```

Bu komut `~/.config/is-ilani-radari/people.json` dosyasını (yoksa) `people.example.json` dosyasından oluşturur ve `scheduled-task/SKILL.md` dosyasını şablondan üretir. Ardından `people.json` dosyasını düzenleyin:

| Alan | Açıklama |
|------|----------|
| `key` | Kısa, tekil kimlik (`a-z`, `0-9`, `-`, `_`). Gönderim kaydının adı buradan gelir: `sent_<key>.json` |
| `name` | Adayın adı |
| `email` | İlanların gönderileceği tek adres |
| `repo_path` | Adayın ai-job-search klonu (`~` kullanılabilir) |
| `greeting` | Mailin ilk satırı, ör. `"Merhaba Deniz,"` |
| `notes` | İsteğe bağlı kişiye özel kurallar: hangi şehirlerde hibrit/ofis uygun, deneyim seviyesi, dil şartlarının nasıl ele alınacağı, bir portalın nasıl çağrılacağı. Örnek için `people.example.json` dosyasına bakın |

`@example.com` adresli kayıtlar görev tarafından atlanır, yani örnek kayıt yanlışlıkla mail almaz. Python yolunu değiştirmek ya da `SKILL.md` dosyasını yeniden üretmek için:

```bash
./install.sh --config --force --python "$(command -v python3.12)"
```

> `--force` ile `people.json` da örnekten yeniden yazılır. Önce yedeğini alın veya `people.json` dosyasını silmeden yalnızca `scheduled-task/SKILL.md` dosyasını silip `./install.sh --config` çalıştırın.

### 5. Zamanlanmış görevi oluşturun

İki yol var:

- **Elle:** Claude masaüstü uygulamasında yeni bir zamanlanmış görev açın, `scheduled-task/SKILL.md` içeriğini istem olarak yapıştırın ve zamanlamayı **hafta içi 09:00 ve 17:00** (cron `0 9,17 * * 1-5`) olarak ayarlayın.
- **Claude'a yaptırın:** Uygulamada Claude'a `scheduled-task/SKILL.md` dosyasını gösterip şunu yazın:
  > bu SKILL.md ile hafta içi 09:00 ve 17:00 çalışan bir zamanlanmış görev oluştur

İlk seferde görevi elle bir kez çalıştırın. Bash, Gmail ve dosya izni isteyen pencereleri onaylayın ki sonraki çalıştırmalar gözetimsiz ilerlesin.

## Gizlilik

- Gönderim kayıtları (`sent_<key>.json`) ve `people.json` repoların **dışında**, `~/.config/is-ilani-radari/` altında tutulur. Bu klasöre yalnızca sizin erişiminiz olur (`chmod 700`).
- Her mail **yalnızca o kişinin kendi adresine** gider (tek alıcı, cc/bcc yok). Bir adayın ilanları başka bir adayın mailine konmaz.
- Görevin son raporunda e-posta adresleri yazılmaz; kişiler `key` ile anılır.
- Geçici tarama dosyaları `/tmp/is-ilani-radari/<key>/` altında, repo dışında tutulur. Repolarda yalnızca upstream'in `job_scraper/seen_jobs.json` dosyası değişir.
- `.gitignore`; `people.json`, `sent_*.json` ve üretilen `scheduled-task/SKILL.md` dosyalarını hariç tutar. Bu depoyu paylaşırken kişisel veri sızmaz.

## Sınırlamalar

- Portal CLI'leri sitelerin **herkese açık sayfalarını** okur, resmi bir API kullanmaz. Her sitenin kullanım koşullarına uyun, istek sayısını düşük tutun ve ticari amaçla ya da toplu veri toplamak için kullanmayın. Sorumluluk kullanıcıdadır.
- Siteler sayfa yapısını değiştirdiğinde portallar **bozulabilir**. `/scrape` her çalıştırmada portal sağlığını denetler ve sorunları mailin sonuna not düşer. Kariyer.net ilan sayfaları zaman zaman WAF ile 403 döndürür (`BLOCKED`).
- Youthall küçük bir sitedir ve çoğunlukla staj/yeni mezun ilanları yayınlar. Belirli unvanlarda az sonuç çıkması normaldir.
- Uyum puanı bir dil modelinin değerlendirmesidir. Başvurmadan önce ilanı mutlaka kendiniz okuyun.
- Görev yalnızca Claude masaüstü uygulaması açıkken ve bilgisayar uyanıkken çalışır.

## Paket içeriği

```
is-ilani-radari/
├── README.md
├── LICENSE                         MIT + NOTICE (upstream atfı)
├── install.sh                      portal kurulumu, izinler, yapılandırma
├── people.example.json             örnek kişi listesi
├── scheduled-task/
│   └── SKILL.template.md           zamanlanmış görev istemi (şablon)
├── portals/
│   ├── kariyernet-search/          Kariyer.net portal skill'i (Bun CLI + testler)
│   └── youthall-search/            Youthall portal skill'i (Bun CLI + testler)
└── assets/                         tanıtım videosu için yer
```

Portal testlerini çalıştırmak için:

```bash
cd portals/kariyernet-search/cli && bun test
cd portals/youthall-search/cli && bun test
```

## Teşekkür ve lisans

Bu paket, **Mads Lorentzen**'in MIT lisanslı açık kaynak çatısı [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search) üzerine kuruludur. `/scrape`, profil dosyaları, değerlendirme kuralları ve portal skill kalıbı upstream'e aittir. Bu paket yalnızca zamanlanmış görevi, Türk portallarını ve kurulum betiğini ekler.

Lisans: [MIT](LICENSE), © 2026 is-ilani-radari contributors. Upstream atfı LICENSE dosyasındaki NOTICE bölümündedir.
