# KURULUM.md — Claude için rehberli kurulum

> **Claude, önce şunu yap:** Bu dosyayı GitHub'da ya da geçici bir yerde okuyorsan, paketi
> doğrudan Adım 1.2'deki yere (`~/IsIlaniRadari/is-ilani-radari`) indir ve oradaki KURULUM.md'yi
> izle; paketi iki kez indirme.
>
> **Bu dosya Claude içindir.** Kullanıcı bunu Claude masaüstü uygulamasında (Code sekmesi)
> Claude'a okutur; Claude aşağıdaki adımları sırayla uygular. Kullanıcının terminal veya
> dosya düzenlemesi bilmesi gerekmez.

## Senin rolün (Claude)

- Kullanıcı bilgisayardan anlamayan biri olabilir. **Sade Türkçe** konuş; "repo, klon, cron,
  JSON, PATH" gibi terimleri kullanıcıya söyleme. Her adımda ne yaptığını tek cümleyle anlat
  ("Gerekli programları kuruyorum, bu 1-2 dakika sürebilir.").
- Soruları mümkünse seçenekli soru aracıyla (AskUserQuestion) sor; bir mesajda en fazla 3 soru.
- Kullanıcıdan yalnızca şunları iste: aday sayısı, her adayın adı ve e-postası, CV dosyaları,
  (isteğe bağlı) çalışma şehri / uzaktan tercihi. Geri kalan her şeyi sen yap.
- Bir komut izin penceresi açarsa kullanıcıya "Açılan pencerede **İzin ver**'e tıklayın" de.
- Bir adım başarısız olursa nedenini sade dille söyle, düzeltmeyi kendin dene; olmazsa
  kullanıcıya tek, net bir eylem öner. Kurulumu yarıda bırakma.
- `sudo` kullanma, sistem ayarlarını değiştirme. Her şey kullanıcının kendi klasörüne kurulur.
- Adayların kişisel verilerini (CV, e-posta) **hiçbir yere yükleme, push etme, paylaşma.**

Aşağıda `KOK` = kurulum kök klasörü:
macOS/Linux `~/IsIlaniRadari`, Windows `%USERPROFILE%\IsIlaniRadari` (Git Bash içinde `~/IsIlaniRadari`).
`PAKET` = `KOK/is-ilani-radari`, `YAPILANDIRMA` = `~/.config/is-ilani-radari`.
Windows'ta komutları Git Bash ile çalıştır (Claude Code Windows'ta zaten Git Bash kullanır).
Komutlarda bu adları her zaman **mutlak yola** çevir ve çift tırnak içinde kullan.

---

## Adım 0 — Ortam kontrolü (kullanıcıya soru sormadan)

1. İşletim sistemini öğren (`uname -s`; `MINGW`/`MSYS` → Windows).
2. **Zamanlanmış görev aracı** var mı bak: araç listende `create_scheduled_task`
   (scheduled-tasks) bulunmalı; gerekirse ToolSearch ile "scheduled task" ara.
   Yoksa kullanıcıya şunu söyle ve dur:
   > Bu kurulum Claude **masaüstü uygulamasının Code sekmesinde** çalışır. Lütfen
   > claude.ai/download adresinden uygulamayı indirip Code sekmesinde yeni bir oturum açın
   > ve aynı cümleyi oraya yapıştırın.
3. **Gmail bağlayıcısı** var mı bak: ToolSearch ile "gmail send email" ara ve açıklaması
   **Gmail**'den mail gönderdiğini söyleyen aracı seç (adı genelde `mcp__<kimlik>__send_message`
   olur; adında "gmail" geçmeyebilir — Slack/Upwork/ajan mesajlaşma araçlarıyla karıştırma).
   Yoksa kullanıcıya:
   > Mailler sizin Gmail hesabınızdan gönderilecek. Uygulamada **Ayarlar → Bağlayıcılar
   > (Connectors) → Gmail → Bağlan**'a tıklayıp hesabınızla giriş yapın, bitince "tamam" yazın.
   Kullanıcı "tamam" deyince tekrar kontrol et; araç hâlâ yoksa yeni bir oturum açmasını iste
   (bağlayıcılar yeni oturumda yüklenir) ve aynı cümleyle devam etmesini söyle — kurulum
   kaldığı yerden sürer (Adım 1–4 tekrar çalıştırılmaya dayanıklıdır).
4. Kullanıcıya kısa bir hoş geldin mesajı ver: ne kurulacağını 3 maddede anlat
   (hafta içi 09:00 ve 17:00'de ilan taraması, CV'ye göre puanlama, yalnızca uygun ve yeni
   ilanların adaya maili) ve kurulumun aday başına ~10-15 dakika (toplam ~25-40 dakika) süreceğini söyle.

## Adım 1 — Programlar (soru sormadan)

1. `mkdir -p KOK`. **macOS'ta önce** `xcode-select -p` çalıştır: hata verirse geliştirici
   araçları kurulu değildir ve `git` / `/usr/bin/python3` yalnızca "kurulsun mu?" penceresi
   açan sahte komutlardır — bu durumda **git ve sistem python3'ünü hiç çağırma**; paketi ve
   çatıyı zip ile indir, Python'u uv ile kur. (Kullanıcıya bir kurulum penceresi açılırsa
   "Şimdi değil" demesini söyle.)
2. **Paket:** `PAKET` yoksa indir. `git` varsa
   `git clone https://github.com/HasanErenAkgoz/is-ilani-radari.git "PAKET"`;
   yoksa `https://github.com/HasanErenAkgoz/is-ilani-radari/archive/refs/heads/main.zip`
   adresini `curl -fsSL` ile geçici bir dosyaya indir, aç ve klasörü `PAKET` olarak adlandır.
   `PAKET` zaten varsa ve git deposuysa `git -C "PAKET" pull` ile güncelle.
3. **Bun** (`bun --version`, ayrıca `~/.bun/bin/bun`): yoksa kur —
   macOS/Linux `curl -fsSL https://bun.sh/install | bash`,
   Windows `powershell -ExecutionPolicy Bypass -c "irm bun.sh/install.ps1 | iex"`.
   Kurulumdan sonra tam yolunu kullan (`~/.bun/bin/bun`).
4. **Python ≥ 3.10:** sırayla `python3.14 python3.13 python3.12 python3.11 python3.10`,
   `~/.local/bin/python3.1*`, sonra `python3 python` (Windows'ta önce `py -3` ve `python`;
   Windows'taki `python3` çoğu zaman Microsoft Store kısayoludur, çalışmazsa atla) adaylarını dene; `sys.version_info >= (3,10)` olan ilkini seç.
   Yoksa kullanıcı düzeyinde kur:
   macOS/Linux `curl -LsSf https://astral.sh/uv/install.sh | sh` ve `~/.local/bin/uv python install 3.12`,
   Windows `powershell -ExecutionPolicy Bypass -c "irm https://astral.sh/uv/install.ps1 | iex"` ve
   `uv python install 3.12`; sonra `uv python find 3.12` ile tam yolu al.
   Seçtiğin yorumlayıcının **tam yolunu** `PY` olarak not et.
   (macOS'ta `python3` komutu geliştirici araçlarını kurmayı öneren bir pencere açarsa
   kullanıcıya "Şimdi değil"e basmasını söyle ve uv ile devam et.)
5. **git** yoksa upstream'i de zip olarak indireceksin (Adım 4); kurmaya çalışma.

## Adım 2 — Adayları öğren

Kullanıcıya sor:
1. Kaç kişi için ilan taranacak? (1–6; kendisi de olabilir)
2. Her kişi için: **adı**, **ilanların gideceği e-posta**, isteğe bağlı **çalışmak istediği
   şehir(ler)** ve "uzaktan da olur mu?".

Her kişiye bir `key` üret: **yalnızca ilk adın** küçük harfli, Türkçe karakterleri
sadeleştirilmiş ASCII hali (ör. "Şule Nur Yılmaz" → `sule`); çakışırsa sonuna sayı ekle
(`sule2`). CV klasörünün adı (`<Ad>`) kullanıcının göreceği addır: ilk ad, Türkçe harfleriyle (ör. `Şule`). Aday klasörü ise `key` olur (ASCII, ör. `adaylar/sule`). E-postanın geçerli
biçimde olduğunu kontrol et; `@example.com` gibi örnek adresleri kabul etme (görev onları
atlar); şüpheliyse tekrar sor. Adları ve e-postaları kullanıcıya geri okuyup onay al.

## Adım 3 — CV'leri al

1. Her aday için `KOK/CV-buraya/<Ad>/` klasörü oluştur.
2. Klasörü kullanıcının ekranında aç: macOS `open "KOK/CV-buraya"`, Windows
   `explorer.exe "$(cygpath -w "KOK/CV-buraya")"` (çıkış kodu 1 normaldir), Linux `xdg-open`.
3. Kullanıcıya:
   > Açılan pencerede her kişinin adıyla bir klasör var. Her kişinin **CV'sini (PDF veya Word)**
   > kendi klasörüne sürükleyip bırakın. Varsa LinkedIn profil PDF'ini de ekleyebilirsiniz.
   > Bitince "bıraktım" yazın.
4. "Bıraktım" deyince her klasörde en az bir `.pdf/.docx/.doc/.txt/.md` dosyası olduğunu kontrol et.
   Eksik olanı adıyla söyle ve bekle. Word dosyasını okuyamazsan PDF olarak kaydetmesini iste.

## Adım 4 — Her aday için kurulum (soru sormadan, aday aday)

Her aday için `KLON = KOK/adaylar/<key>`:

1. **Çatıyı indir:** `KLON` yoksa
   `git clone https://github.com/ai-job-search-dev/ai-job-search.git "KLON"`
   (git yoksa `https://github.com/ai-job-search-dev/ai-job-search/archive/refs/heads/main.zip`).
   Git varsa kişisel veri yanlışlıkla herkese açık bir yere gitmesin diye
   `git -C "KLON" remote set-url --push origin DISABLED` çalıştır.
2. **CV'leri kopyala:** `KOK/CV-buraya/<Ad>/` içindekileri `KLON/documents/cv/`'ye
   (adı "linkedin" içeren PDF'i `KLON/documents/linkedin/`'e) kopyala.
3. **Portalları ekle ve izinleri ver:**
   `bash "PAKET/install.sh" --community --permissions --python "PY" "KLON"`.
   Bu komut Kariyer.net ve Youthall'ı bu paketten, Freehire ve LinkedIn'i resmi
   community-portals deposundan kurar (upstream çatı 2026-11'den beri portal içermez) ve izin
   satırlarını ekler. Başarısız olursa hatayı oku; portalları `KLON/.agents/skills/` altına
   kendin kopyala (klasör yoksa oluştur) ve install.sh'deki `add_permissions` bölümünün
   yaptığını (izin satırlarının `KLON/.claude/settings.json` ve `KLON/tools/security_guards.py`
   içine eklenmesi) elle uygula; sonra `"PY" tools/security_guards.py` ile doğrula.
4. **Portal bağımlılıkları:** `cd "KLON" && export PATH="$HOME/.bun/bin:$PATH" && "PY" tools/install_portal_clis.py`.
5. **Portallar:** `kariyernet-search`, `youthall-search`, `freehire-search` açık
   (`enabled: true`) kalsın. **LinkedIn** (`linkedin-search`) kapalı gelir, çünkü LinkedIn
   otomatik erişimi kullanım koşullarında yasaklar. İlk adayda kullanıcıya bir kez sor:
   > LinkedIn ilanlarını da doğrudan tarayayım mı? LinkedIn bunu kurallarında yasaklıyor;
   > kişisel kullanımda risk sizde olur. Açmazsanız LinkedIn ilanları yine de internet
   > aramasıyla kısmen bulunur.
   Yalnızca açık bir "evet" gelirse tüm adaylarda `linkedin-search/SKILL.md` başlığındaki
   satırı `enabled: true` yap. Varsayılan: kapalı.
6. **Profili doldur:** `KLON/.claude/commands/setup.md` dosyasını oku ve **Path A (Documents
   folder)** akışını bu klon için uygula (tüm dosya yolları `KLON`'a göre). Uyarlamalar:
   - "Public fork" uyarısını ve yol seçimi sorusunu atla; doğrudan Path A.
   - setup.md'nin **iş portalları** sorusunu ve kopyalama istemini atla (portallar Adım 4.3'te
     kuruldu); CV şablonu/dili, ön yazı, LaTeX gibi başvuru belgesiyle ilgili soruları da atla.
   - Kullanıcıya aday başına **en fazla şu 3 soruyu, tek mesajda** sor (CV'den net çıkıyorsa
     sorma): hedef pozisyon(lar), deneyim seviyesi (yeni mezun / 1-3 yıl / 3+ yıl),
     kesinlikle istemediği şeyler (ör. vardiya, saha işi). "Bilmiyorum/atla" kabul edilir;
     makul bir varsayılan yaz. Maaş sorma.
   - LinkedIn dışa aktarımı veya referans mektubu yoksa `02-behavioral-profile.md`'yi zorla
     doldurma; olduğu gibi bırak.
   - **Doldurulacak dosyalar** (yer tutucu metinleri tamamen değiştir; yalnız küçük düzeltme
     değil): `CLAUDE.md`, `.claude/skills/job-application-assistant/01-candidate-profile.md`,
     `04-job-evaluation.md`, `.claude/skills/job-scraper/search-queries.md`.
     **Dokunma:** `02`, `05`, `06`, `07` profil dosyaları ve `cv/main_example.tex` (başvuru
     belgesi üretimi bu otomasyonun parçası değil).
   - Profil dili **Türkçe** (aksi istenmedikçe); arama terimleri Türkçe, gerekirse İngilizce eşleriyle.
   - Dosya değişikliklerini tek mesajda kısa özetleyip bir kez onay al.
   - Pazar **Türkiye**, iş dili Türkçe + İngilizce. Adım 2'deki şehir/uzaktan tercihini konum
     kuralı olarak `04-job-evaluation.md`'ye yaz.
   - `.claude/skills/job-scraper/search-queries.md` dosyasına adayın CV'sine uygun
     **Türkçe düz arama terimleri** ekle (ör. "veri analisti", "muhasebe uzmanı"); tırnak/OR yok.
7. **Sağlık kontrolü (yalnızca ilk adayda, bir kez):** `KLON` içinde job-scraper `SKILL.md`'deki
   portal sağlık kontrolünü (`/scrape health`, Step 4.75) çalıştır; portallar her adayda aynı
   olduğu için diğer adaylarda tekrarlama. Açık portalların en az biri çalışır olmalı; hepsi
   bozuksa kullanıcıya söyle ama kuruluma devam et (siteler geçici engelleyebilir).
   Freehire bir toplayıcıdır: ilan linklerinin başka sitelere (şirket sayfaları, LinkedIn)
   gitmesi normaldir, bunu "bozuk" sayma.

Her adayın sonunda kullanıcıya tek satır özet ver ("Deniz hazır: Veri Analisti, İstanbul/uzaktan,
4 portal açık.").

## Adım 5 — Kişi listesi ve görev metni

1. `bash "PAKET/install.sh" --config --python "PY"` çalıştır (yapılandırma klasörünü değiştirmek
   gerekirse `--config-dir DIR` ya da `IS_ILANI_RADARI_CONFIG_DIR`) (`YAPILANDIRMA/people.json` ve
   `PAKET/scheduled-task/SKILL.md` oluşur). Çalışmazsa ikisini kendin üret: şablon
   `PAKET/scheduled-task/SKILL.template.md` içinde `{{CONFIG_DIR}}` → `YAPILANDIRMA`,
   `{{PYTHON}}` → `PY`.
2. `people.json`'u Adım 2–4'teki gerçek bilgilerle **yeniden yaz** (örnek kayıtlar kalmasın):
   her aday için `key`, `name` (ilk ad, Türkçe harfleriyle), `email`, `repo_path` (= `KLON`, mutlak yol), `greeting`
   ("Merhaba <Ad>,"), `notes` (şehir/uzaktan tercihi ve CV'den çıkan özel durumlar, ör.
   "giriş seviyesi: 3+ yıl şartı olan ilanlar Low"). Dosyayı `PY` ile UTF-8 olarak yaz ve
   geri okuyup geçerli JSON olduğunu doğrula.
3. macOS/Linux'ta `chmod 700 "YAPILANDIRMA"`.

## Adım 6 — Zamanlanmış görevi oluştur

Kullanıcıya özetle ve onay al:
> Hafta içi her gün **09:00 ve 17:00**'de <adlar> için ilan taranacak; uygun ve yeni ilan
> bulunursa her kişiye yalnızca kendi ilanları sizin Gmail hesabınızdan gönderilecek.
> Uygun ilan yoksa mail gitmez. Görevi oluşturayım mı?

Onaylanınca `create_scheduled_task` çağır:
- `taskId`: `is-ilani-radari` (doluysa aracın önerdiği ad)
- `title`: `İş İlanı Radarı (hafta içi 09:00 & 17:00)`
- `description`: tek cümlelik görev özeti
- `cronExpression`: `0 9,17 * * 1-5`
- `prompt`: `PAKET/scheduled-task/SKILL.md` dosyasının **gövdesi** (en üstteki `---` başlık
  bloğu hariç), değiştirmeden.

## Adım 7 — Deneme çalıştırması

Deneme çalıştırması **gereklidir**: görev bir çalışma klasörüne bağlı olmadığından, sonraki
gözetimsiz taramaların izin sormadan ilerlemesini sağlayan şey bu ilk çalıştırmada verilen
"Her zaman izin ver" onaylarıdır. Kullanıcıya bunu sade dille söyle ve sor: "Şimdi ilk taramayı
başlatayım mı? Uygun ilan çıkarsa adaylara **gerçek mail** gider." Evet derse:
1. `run_scheduled_task` ile görevi bir kez başlat.
2. Kullanıcıya: "Tarama ayrı bir oturumda başladı (sol listede görebilirsiniz). İzin soran
   pencerelerde **Her zaman izin ver** seçin; böylece sonraki taramalar sizi rahatsız etmeden
   çalışır. Tarama kişi başına birkaç dakika sürer."
   (Not: görev, adayların klasörlerinin dışında çalıştığı için o klasörlerdeki izin ayarları
   görevde geçerli olmayabilir; asıl kalıcı izin, görevin ilk çalıştırmasında verilen
   "Her zaman izin ver" onaylarıdır. Bu yüzden deneme çalıştırmasını önemle öner.)
Hayır derse ilk taramanın bir sonraki 09:00 veya 17:00'de olacağını söyle ve o ilk taramada
izin pencerelerini onaylaması gerektiğini hatırlat.

## Adım 8 — Kapanış

Kullanıcıya kısa, sade bir özet yaz:
- Kimler için, hangi saatlerde tarama yapılacağı.
- **Önemli:** Tarama yalnızca bilgisayar açıkken ve Claude uygulaması açıkken çalışır;
  o saatte kapalıysa uygulama açıldığında çalışır.
- Değişiklik için Claude'a doğal dille yazabileceği örnekler:
  "İş İlanı Radarı'na yeni aday ekle", "Deniz'in CV'sini güncelle", "Ece'yi listeden çıkar",
  "taramayı durdur". (Bu istekler geldiğinde aşağıdaki **Bakım** bölümünü uygula.)

---

## Bakım (sonraki isteklerde)

Kullanıcı bu konularda bir şey isterse önce `~/IsIlaniRadari/is-ilani-radari/KURULUM.md`'yi oku.

- **Yeni aday:** Adım 2'deki soruları tek kişi için sor → Adım 3 → Adım 4 → `people.json`'a
  ekle. Görevi değiştirmeye gerek yok (liste her çalıştırmada okunur).
- **CV güncelleme:** Yeni CV'yi `KLON/documents/cv/`'ye koy, `setup.md` Path A'yı yeniden
  çalıştır (değişiklikleri birleştirir).
- **Aday çıkarma:** `people.json`'dan kaydı sil. Klasörünü silmeden önce kullanıcıya sor.
- **Durdurma / saat değiştirme:** `update_scheduled_task` ile görevi kapat veya
  `cronExpression`'ı değiştir (ör. yalnızca sabah: `0 9 * * 1-5`).
- **Güncelleme:** `git -C "PAKET" pull` (zip ile kurulduysa yeniden indir), sonra her `KLON` için
  `bash "PAKET/install.sh" --community --force --permissions --python "PY" "KLON"`.

## Windows notları (denenmedi, en iyi tahmin)

- Komutları Git Bash'te çalıştır; `explorer.exe` klasörü açsa bile çıkış kodu 1 döndürür —
  bunu hata sayma.
- Python için önce `py -3`, sonra `python` dene; `uv python find` `C:\...` biçiminde yol verir,
  `PY` olarak bunu tırnak içinde kullan.
- Görev şablonundaki geçici klasör (`/tmp/is-ilani-radari`) yerel Python'da çözülmezse
  `$TEMP/is-ilani-radari` kullanacak şekilde `SKILL.md`'yi düzenle.
