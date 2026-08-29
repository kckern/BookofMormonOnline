#!/usr/bin/env node
import crypto from 'node:crypto';
import process from 'node:process';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const KEYS = [
  'cancel', 'select_paste_drop_image', 'img_limits', 'change_profile_photo',
  'choose_group_image', 'crop_image', 'crop_image_help', 'zoom', 'rotate_left',
  'rotate_right', 'reset', 'choose_another_image', 'save_profile_photo',
  'use_group_image', 'saving_image', 'processing_image', 'profile_updated',
  'image_type_unsupported', 'image_too_large', 'image_read_failed',
  'image_process_failed', 'image_upload_failed', 'profile_image_session_expired',
  'close_image_editor',
];

const COPY = {
  en: [
    'Cancel', 'Choose, drop, or paste an image', 'JPG or PNG, up to 25 MB.',
    'Change profile photo', 'Choose group image', 'Crop image',
    'Drag to reposition. Use zoom or rotate as needed.', 'Zoom', 'Rotate left',
    'Rotate right', 'Reset', 'Choose another image', 'Save profile photo',
    'Use group image', 'Saving image…', 'Processing image…',
    'Profile photo updated.', 'Choose a JPG or PNG image.',
    'Choose an image smaller than 25 MB.',
    'This image could not be opened. Try another file.',
    'This image could not be cropped. Try another file.',
    'The image could not be saved. Check your connection and try again.',
    'Sign in again before updating your profile photo.', 'Close image editor',
  ],
  fr: [
    'Annuler', 'Choisir, déposer ou coller une image', 'JPG ou PNG, jusqu’à 25 Mo.',
    'Modifier la photo de profil', 'Choisir l’image du groupe', 'Recadrer l’image',
    'Faites glisser pour repositionner. Utilisez le zoom ou la rotation si nécessaire.', 'Zoom', 'Rotation à gauche',
    'Rotation à droite', 'Réinitialiser', 'Choisir une autre image', 'Enregistrer la photo de profil',
    'Utiliser l’image du groupe', 'Enregistrement de l’image…', 'Traitement de l’image…',
    'Photo de profil mise à jour.', 'Choisissez une image JPG ou PNG.',
    'Choisissez une image de moins de 25 Mo.',
    'Impossible d’ouvrir cette image. Essayez un autre fichier.',
    'Impossible de recadrer cette image. Essayez un autre fichier.',
    'Impossible d’enregistrer l’image. Vérifiez votre connexion et réessayez.',
    'Reconnectez-vous avant de modifier votre photo de profil.', 'Fermer l’éditeur d’image',
  ],
  de: [
    'Abbrechen', 'Bild auswählen, ablegen oder einfügen', 'JPG oder PNG, bis zu 25 MB.',
    'Profilfoto ändern', 'Gruppenbild auswählen', 'Bild zuschneiden',
    'Zum Verschieben ziehen. Bei Bedarf zoomen oder drehen.', 'Zoom', 'Nach links drehen',
    'Nach rechts drehen', 'Zurücksetzen', 'Anderes Bild auswählen', 'Profilfoto speichern',
    'Gruppenbild verwenden', 'Bild wird gespeichert…', 'Bild wird verarbeitet…',
    'Profilfoto aktualisiert.', 'Wählen Sie ein JPG- oder PNG-Bild aus.',
    'Wählen Sie ein Bild unter 25 MB aus.',
    'Dieses Bild konnte nicht geöffnet werden. Versuchen Sie eine andere Datei.',
    'Dieses Bild konnte nicht zugeschnitten werden. Versuchen Sie eine andere Datei.',
    'Das Bild konnte nicht gespeichert werden. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
    'Melden Sie sich erneut an, bevor Sie Ihr Profilfoto ändern.', 'Bildeditor schließen',
  ],
  nl: [
    'Annuleren', 'Kies, sleep of plak een afbeelding', 'JPG of PNG, maximaal 25 MB.',
    'Profielfoto wijzigen', 'Groepsafbeelding kiezen', 'Afbeelding bijsnijden',
    'Sleep om te verplaatsen. Gebruik zoomen of draaien indien nodig.', 'Zoom', 'Linksom draaien',
    'Rechtsom draaien', 'Opnieuw instellen', 'Andere afbeelding kiezen', 'Profielfoto opslaan',
    'Groepsafbeelding gebruiken', 'Afbeelding opslaan…', 'Afbeelding verwerken…',
    'Profielfoto bijgewerkt.', 'Kies een JPG- of PNG-afbeelding.',
    'Kies een afbeelding kleiner dan 25 MB.',
    'Deze afbeelding kon niet worden geopend. Probeer een ander bestand.',
    'Deze afbeelding kon niet worden bijgesneden. Probeer een ander bestand.',
    'De afbeelding kon niet worden opgeslagen. Controleer uw verbinding en probeer opnieuw.',
    'Meld u opnieuw aan voordat u uw profielfoto wijzigt.', 'Afbeeldingseditor sluiten',
  ],
  pt: [
    'Cancelar', 'Escolha, arraste ou cole uma imagem', 'JPG ou PNG, até 25 MB.',
    'Alterar foto do perfil', 'Escolher imagem do grupo', 'Recortar imagem',
    'Arraste para reposicionar. Use zoom ou rotação se necessário.', 'Zoom', 'Girar para a esquerda',
    'Girar para a direita', 'Redefinir', 'Escolher outra imagem', 'Salvar foto do perfil',
    'Usar imagem do grupo', 'Salvando imagem…', 'Processando imagem…',
    'Foto do perfil atualizada.', 'Escolha uma imagem JPG ou PNG.',
    'Escolha uma imagem menor que 25 MB.',
    'Não foi possível abrir esta imagem. Tente outro arquivo.',
    'Não foi possível recortar esta imagem. Tente outro arquivo.',
    'Não foi possível salvar a imagem. Verifique sua conexão e tente novamente.',
    'Entre novamente antes de alterar sua foto do perfil.', 'Fechar editor de imagem',
  ],
  ko: [
    '취소', '이미지를 선택하거나 끌어다 놓거나 붙여넣으세요', 'JPG 또는 PNG, 최대 25MB.',
    '프로필 사진 변경', '그룹 이미지 선택', '이미지 자르기',
    '드래그하여 위치를 조정하세요. 필요하면 확대/축소하거나 회전하세요.', '확대/축소', '왼쪽으로 회전',
    '오른쪽으로 회전', '초기화', '다른 이미지 선택', '프로필 사진 저장',
    '그룹 이미지 사용', '이미지 저장 중…', '이미지 처리 중…',
    '프로필 사진이 업데이트되었습니다.', 'JPG 또는 PNG 이미지를 선택하세요.',
    '25MB보다 작은 이미지를 선택하세요.',
    '이 이미지를 열 수 없습니다. 다른 파일을 사용해 보세요.',
    '이 이미지를 자를 수 없습니다. 다른 파일을 사용해 보세요.',
    '이미지를 저장할 수 없습니다. 연결을 확인하고 다시 시도하세요.',
    '프로필 사진을 변경하기 전에 다시 로그인하세요.', '이미지 편집기 닫기',
  ],
  jp: [
    'キャンセル', '画像を選択、ドロップ、または貼り付け', 'JPG または PNG、最大 25 MB。',
    'プロフィール写真を変更', 'グループ画像を選択', '画像を切り抜く',
    'ドラッグして位置を調整します。必要に応じてズームまたは回転してください。', 'ズーム', '左に回転',
    '右に回転', 'リセット', '別の画像を選択', 'プロフィール写真を保存',
    'グループ画像を使用', '画像を保存しています…', '画像を処理しています…',
    'プロフィール写真を更新しました。', 'JPG または PNG 画像を選択してください。',
    '25 MB 未満の画像を選択してください。',
    'この画像を開けませんでした。別のファイルをお試しください。',
    'この画像を切り抜けませんでした。別のファイルをお試しください。',
    '画像を保存できませんでした。接続を確認してもう一度お試しください。',
    'プロフィール写真を更新する前に、もう一度ログインしてください。', '画像エディターを閉じる',
  ],
  zh: [
    '取消', '选择、拖放或粘贴图片', 'JPG 或 PNG，最大 25 MB。',
    '更改个人资料照片', '选择群组图片', '裁剪图片',
    '拖动以调整位置。需要时可缩放或旋转。', '缩放', '向左旋转',
    '向右旋转', '重置', '选择其他图片', '保存个人资料照片',
    '使用群组图片', '正在保存图片…', '正在处理图片…',
    '个人资料照片已更新。', '请选择 JPG 或 PNG 图片。',
    '请选择小于 25 MB 的图片。',
    '无法打开此图片。请尝试其他文件。',
    '无法裁剪此图片。请尝试其他文件。',
    '无法保存图片。请检查网络连接后重试。',
    '请重新登录后再更新个人资料照片。', '关闭图片编辑器',
  ],
  ru: [
    'Отмена', 'Выберите, перетащите или вставьте изображение', 'JPG или PNG, до 25 МБ.',
    'Изменить фото профиля', 'Выбрать изображение группы', 'Обрезать изображение',
    'Перетащите, чтобы изменить положение. При необходимости измените масштаб или поверните.', 'Масштаб', 'Повернуть влево',
    'Повернуть вправо', 'Сбросить', 'Выбрать другое изображение', 'Сохранить фото профиля',
    'Использовать изображение группы', 'Сохранение изображения…', 'Обработка изображения…',
    'Фото профиля обновлено.', 'Выберите изображение JPG или PNG.',
    'Выберите изображение размером менее 25 МБ.',
    'Не удалось открыть изображение. Попробуйте другой файл.',
    'Не удалось обрезать изображение. Попробуйте другой файл.',
    'Не удалось сохранить изображение. Проверьте подключение и повторите попытку.',
    'Войдите снова, прежде чем обновлять фото профиля.', 'Закрыть редактор изображений',
  ],
  hi: [
    'रद्द करें', 'चित्र चुनें, खींचकर छोड़ें या चिपकाएँ', 'JPG या PNG, अधिकतम 25 MB।',
    'प्रोफ़ाइल फ़ोटो बदलें', 'समूह चित्र चुनें', 'चित्र काटें',
    'स्थान बदलने के लिए खींचें। आवश्यकता अनुसार ज़ूम या घुमाएँ।', 'ज़ूम', 'बाएँ घुमाएँ',
    'दाएँ घुमाएँ', 'रीसेट करें', 'दूसरा चित्र चुनें', 'प्रोफ़ाइल फ़ोटो सहेजें',
    'समूह चित्र उपयोग करें', 'चित्र सहेजा जा रहा है…', 'चित्र संसाधित हो रहा है…',
    'प्रोफ़ाइल फ़ोटो अपडेट हो गई।', 'JPG या PNG चित्र चुनें।',
    '25 MB से छोटा चित्र चुनें।',
    'यह चित्र खोला नहीं जा सका। दूसरी फ़ाइल आज़माएँ।',
    'यह चित्र काटा नहीं जा सका। दूसरी फ़ाइल आज़माएँ।',
    'चित्र सहेजा नहीं जा सका। अपना कनेक्शन जाँचें और फिर प्रयास करें।',
    'प्रोफ़ाइल फ़ोटो अपडेट करने से पहले फिर से साइन इन करें।', 'चित्र संपादक बंद करें',
  ],
  eo: [
    'Nuligi', 'Elektu, demetu aŭ algluu bildon', 'JPG aŭ PNG, ĝis 25 MB.',
    'Ŝanĝi profilfoton', 'Elekti grupbildon', 'Stuci bildon',
    'Trenu por repoziciigi. Uzu zomon aŭ turnon laŭbezone.', 'Zomo', 'Turni maldekstren',
    'Turni dekstren', 'Restarigi', 'Elekti alian bildon', 'Konservi profilfoton',
    'Uzi grupbildon', 'Konservante bildon…', 'Prilaborante bildon…',
    'Profilfoto ĝisdatigita.', 'Elektu JPG- aŭ PNG-bildon.',
    'Elektu bildon malpli grandan ol 25 MB.',
    'Ĉi tiu bildo ne povis esti malfermita. Provu alian dosieron.',
    'Ĉi tiu bildo ne povis esti stucita. Provu alian dosieron.',
    'La bildo ne povis esti konservita. Kontrolu vian konekton kaj reprovu.',
    'Ensalutu denove antaŭ ol ĝisdatigi vian profilfoton.', 'Fermi bildredaktilon',
  ],
  es: [
    'Cancelar', 'Elige, arrastra o pega una imagen', 'JPG o PNG, hasta 25 MB.',
    'Cambiar foto de perfil', 'Elegir imagen del grupo', 'Recortar imagen',
    'Arrastra para cambiar la posición. Usa el zoom o gira según sea necesario.', 'Zoom', 'Girar a la izquierda',
    'Girar a la derecha', 'Restablecer', 'Elegir otra imagen', 'Guardar foto de perfil',
    'Usar imagen del grupo', 'Guardando imagen…', 'Procesando imagen…',
    'Foto de perfil actualizada.', 'Elige una imagen JPG o PNG.',
    'Elige una imagen de menos de 25 MB.',
    'No se pudo abrir esta imagen. Prueba con otro archivo.',
    'No se pudo recortar esta imagen. Prueba con otro archivo.',
    'No se pudo guardar la imagen. Comprueba tu conexión e inténtalo de nuevo.',
    'Vuelve a iniciar sesión antes de actualizar tu foto de perfil.', 'Cerrar editor de imágenes',
  ],
  vn: [
    'Hủy', 'Chọn, kéo thả hoặc dán hình ảnh', 'JPG hoặc PNG, tối đa 25 MB.',
    'Đổi ảnh hồ sơ', 'Chọn ảnh nhóm', 'Cắt ảnh',
    'Kéo để đổi vị trí. Thu phóng hoặc xoay khi cần.', 'Thu phóng', 'Xoay trái',
    'Xoay phải', 'Đặt lại', 'Chọn ảnh khác', 'Lưu ảnh hồ sơ',
    'Dùng ảnh nhóm', 'Đang lưu ảnh…', 'Đang xử lý ảnh…',
    'Đã cập nhật ảnh hồ sơ.', 'Hãy chọn ảnh JPG hoặc PNG.',
    'Hãy chọn ảnh nhỏ hơn 25 MB.',
    'Không thể mở ảnh này. Hãy thử tệp khác.',
    'Không thể cắt ảnh này. Hãy thử tệp khác.',
    'Không thể lưu ảnh. Hãy kiểm tra kết nối và thử lại.',
    'Hãy đăng nhập lại trước khi cập nhật ảnh hồ sơ.', 'Đóng trình chỉnh sửa ảnh',
  ],
  tgl: [
    'Kanselahin', 'Pumili, mag-drop, o mag-paste ng larawan', 'JPG o PNG, hanggang 25 MB.',
    'Palitan ang larawan sa profile', 'Pumili ng larawan ng grupo', 'I-crop ang larawan',
    'I-drag para ilipat. Mag-zoom o mag-rotate kung kailangan.', 'Zoom', 'I-rotate pakaliwa',
    'I-rotate pakanan', 'I-reset', 'Pumili ng ibang larawan', 'I-save ang larawan sa profile',
    'Gamitin ang larawan ng grupo', 'Sine-save ang larawan…', 'Pinoproseso ang larawan…',
    'Na-update ang larawan sa profile.', 'Pumili ng JPG o PNG na larawan.',
    'Pumili ng larawang mas maliit sa 25 MB.',
    'Hindi mabuksan ang larawang ito. Sumubok ng ibang file.',
    'Hindi ma-crop ang larawang ito. Sumubok ng ibang file.',
    'Hindi ma-save ang larawan. Suriin ang koneksyon at subukan muli.',
    'Mag-sign in muli bago i-update ang larawan sa profile.', 'Isara ang editor ng larawan',
  ],
  th: [
    'ยกเลิก', 'เลือก ลากวาง หรือวางรูปภาพ', 'JPG หรือ PNG ขนาดไม่เกิน 25 MB',
    'เปลี่ยนรูปโปรไฟล์', 'เลือกรูปกลุ่ม', 'ครอบตัดรูปภาพ',
    'ลากเพื่อปรับตำแหน่ง ซูมหรือหมุนตามต้องการ', 'ซูม', 'หมุนซ้าย',
    'หมุนขวา', 'รีเซ็ต', 'เลือกรูปอื่น', 'บันทึกรูปโปรไฟล์',
    'ใช้รูปกลุ่ม', 'กำลังบันทึกรูปภาพ…', 'กำลังประมวลผลรูปภาพ…',
    'อัปเดตรูปโปรไฟล์แล้ว', 'เลือกรูปภาพ JPG หรือ PNG',
    'เลือกรูปภาพที่เล็กกว่า 25 MB',
    'ไม่สามารถเปิดรูปภาพนี้ได้ ลองใช้ไฟล์อื่น',
    'ไม่สามารถครอบตัดรูปภาพนี้ได้ ลองใช้ไฟล์อื่น',
    'ไม่สามารถบันทึกรูปภาพได้ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
    'ลงชื่อเข้าใช้อีกครั้งก่อนอัปเดตรูปโปรไฟล์', 'ปิดเครื่องมือแก้ไขรูปภาพ',
  ],
  ukr: [
    'Скасувати', 'Виберіть, перетягніть або вставте зображення', 'JPG або PNG, до 25 МБ.',
    'Змінити фото профілю', 'Вибрати зображення групи', 'Обрізати зображення',
    'Перетягніть, щоб змінити положення. За потреби масштабуйте або поверніть.', 'Масштаб', 'Повернути ліворуч',
    'Повернути праворуч', 'Скинути', 'Вибрати інше зображення', 'Зберегти фото профілю',
    'Використати зображення групи', 'Збереження зображення…', 'Обробка зображення…',
    'Фото профілю оновлено.', 'Виберіть зображення JPG або PNG.',
    'Виберіть зображення розміром менше 25 МБ.',
    'Не вдалося відкрити це зображення. Спробуйте інший файл.',
    'Не вдалося обрізати це зображення. Спробуйте інший файл.',
    'Не вдалося зберегти зображення. Перевірте з’єднання та спробуйте ще раз.',
    'Увійдіть знову перед оновленням фото профілю.', 'Закрити редактор зображень',
  ],
  tam: [
    'ரத்துசெய்', 'படத்தைத் தேர்ந்தெடுக்கவும், இழுத்து விடவும் அல்லது ஒட்டவும்', 'JPG அல்லது PNG, அதிகபட்சம் 25 MB.',
    'சுயவிவரப் படத்தை மாற்று', 'குழுப் படத்தைத் தேர்ந்தெடு', 'படத்தை வெட்டு',
    'இடத்தை மாற்ற இழுக்கவும். தேவைக்கேற்ப பெரிதாக்கவும் அல்லது சுழற்றவும்.', 'பெரிதாக்கு', 'இடப்புறம் சுழற்று',
    'வலப்புறம் சுழற்று', 'மீட்டமை', 'வேறொரு படத்தைத் தேர்ந்தெடு', 'சுயவிவரப் படத்தைச் சேமி',
    'குழுப் படத்தைப் பயன்படுத்து', 'படம் சேமிக்கப்படுகிறது…', 'படம் செயலாக்கப்படுகிறது…',
    'சுயவிவரப் படம் புதுப்பிக்கப்பட்டது.', 'JPG அல்லது PNG படத்தைத் தேர்ந்தெடுக்கவும்.',
    '25 MB-க்கும் குறைவான படத்தைத் தேர்ந்தெடுக்கவும்.',
    'இந்தப் படத்தைத் திறக்க முடியவில்லை. வேறொரு கோப்பை முயற்சிக்கவும்.',
    'இந்தப் படத்தை வெட்ட முடியவில்லை. வேறொரு கோப்பை முயற்சிக்கவும்.',
    'படத்தைச் சேமிக்க முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
    'சுயவிவரப் படத்தைப் புதுப்பிக்கும் முன் மீண்டும் உள்நுழையவும்.', 'படத் திருத்தியை மூடு',
  ],
  swe: [
    'Avbryt', 'Välj, släpp eller klistra in en bild', 'JPG eller PNG, upp till 25 MB.',
    'Ändra profilbild', 'Välj gruppbild', 'Beskär bild',
    'Dra för att flytta. Zooma eller rotera vid behov.', 'Zoom', 'Rotera åt vänster',
    'Rotera åt höger', 'Återställ', 'Välj en annan bild', 'Spara profilbild',
    'Använd gruppbild', 'Sparar bild…', 'Bearbetar bild…',
    'Profilbilden har uppdaterats.', 'Välj en JPG- eller PNG-bild.',
    'Välj en bild som är mindre än 25 MB.',
    'Bilden kunde inte öppnas. Prova en annan fil.',
    'Bilden kunde inte beskäras. Prova en annan fil.',
    'Bilden kunde inte sparas. Kontrollera anslutningen och försök igen.',
    'Logga in igen innan du uppdaterar profilbilden.', 'Stäng bildredigeraren',
  ],
};

const NON_ENGLISH = ['fr', 'de', 'nl', 'pt', 'ko', 'jp', 'zh', 'ru', 'hi', 'eo', 'es', 'vn', 'tgl', 'th', 'ukr', 'tam', 'swe'];

function validateCopy() {
  const expected = ['en', ...NON_ENGLISH].sort();
  const actual = Object.keys(COPY).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Locale mismatch: ${actual.join(',')}`);
  for (const [lang, values] of Object.entries(COPY)) {
    if (values.length !== KEYS.length) throw new Error(`${lang}: expected ${KEYS.length} strings, got ${values.length}`);
    if (values.some((value) => !String(value).trim())) throw new Error(`${lang}: blank translation`);
  }
}

function guidFor(key) {
  return `upl${crypto.createHash('sha256').update(`image-editor:${key}`).digest('hex').slice(0, 10)}`;
}

async function connect() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB || 'bom_prd',
    ssl: { rejectUnauthorized: false },
  });
}

async function verify(db) {
  const [base] = await db.query('SELECT label_id FROM bom_label WHERE label_id IN (?)', [KEYS]);
  const [translations] = await db.query(
    `SELECT l.label_id, COUNT(DISTINCT t.lang) AS n
       FROM bom_label l
       LEFT JOIN bom_translation t ON t.guid=l.guid AND t.refkey='label_text' AND t.lang IN (?)
      WHERE l.label_id IN (?) GROUP BY l.label_id`,
    [NON_ENGLISH, KEYS],
  );
  const coverage = new Map(translations.map((row) => [row.label_id, Number(row.n)]));
  const missingBase = KEYS.filter((key) => !base.some((row) => row.label_id === key));
  const incomplete = KEYS.filter((key) => coverage.get(key) !== NON_ENGLISH.length);
  return { base: base.length, translated: translations.reduce((sum, row) => sum + Number(row.n), 0), missingBase, incomplete };
}

async function apply(db) {
  await db.beginTransaction();
  try {
    for (let index = 0; index < KEYS.length; index += 1) {
      const key = KEYS[index];
      await db.query(
        `INSERT INTO bom_label (guid,label_id,label_text,type) VALUES (?,?,?,'upload')
         ON DUPLICATE KEY UPDATE label_text=VALUES(label_text), type='upload'`,
        [guidFor(key), key, COPY.en[index]],
      );
      const [[row]] = await db.query('SELECT guid FROM bom_label WHERE label_id=?', [key]);
      for (const lang of NON_ENGLISH) {
        await db.query(
          `INSERT INTO bom_translation (guid,lang,refkey,value,contributor,auditor,time)
           VALUES (?,?,'label_text',?,'migration:image-editor','',NOW())
           ON DUPLICATE KEY UPDATE value=VALUES(value), contributor=VALUES(contributor), time=VALUES(time)`,
          [row.guid, lang, COPY[lang][index]],
        );
      }
    }
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

validateCopy();
const shouldApply = process.argv.includes('--apply');
const db = await connect();
try {
  const before = await verify(db);
  if (shouldApply) await apply(db);
  const after = await verify(db);
  console.log(JSON.stringify({ mode: shouldApply ? 'apply' : 'check', expectedBase: KEYS.length, expectedTranslations: KEYS.length * NON_ENGLISH.length, before, after }, null, 2));
  if (shouldApply && (after.missingBase.length || after.incomplete.length)) process.exitCode = 1;
} finally {
  await db.end();
}
