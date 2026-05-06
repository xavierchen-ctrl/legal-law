// 使用者目錄：email、姓名、直屬主管
// 用於催辦提醒信的收件人查找

interface UserRecord {
    email: string;
    name: string;         // 姓名欄（可含中英混合）
    supervisorName: string; // 直屬主管欄（可含 _EnglishName 後綴）
}

const DIRECTORY: UserRecord[] = [
    { email: 'forgemini0212@gmail.com', name: '研發測試用', supervisorName: '蔣耀庭_Peter Chiang' },
    { email: 'thea.chen@wavenet.com.tw', name: '陳芳絜', supervisorName: '' },
    { email: 'jasmine.shen@wavenet.com.tw', name: '沈婉榆', supervisorName: '黃千奕_Candy Huang' },
    { email: 'xavier.chen@wavenet.com.tw', name: '陳冠廷_Xavier Chen', supervisorName: '賴昱安_William Lai' },
    { email: 'annie.shi@partner.wavenet.com.tw', name: '史安倪', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'yelina.huang@partner.wavenet.com.tw', name: '黃楷婷 Yelina', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'angela.chang@partner.wavenet.com.tw', name: '張丞儀', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'sheena.ling@partner.wavenet.com.tw', name: '凌芷瑄 Sheena', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'gin.chuang@partner.wavenet.com.tw', name: '莊爵安_Ginny Chuang', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'zoe.chen@partner.wavenet.com.tw', name: '陳咨頤', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'jenny.chen@partner.wavenet.com.tw', name: '陳怡均_Jenny Chen', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'shaney.hu@wavenet.com.tw', name: 'Shaney', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'mei.huang@wavenet.com.tw', name: '黃美仙', supervisorName: '林啟耀_Ivan Lim' },
    { email: 'perci.kung@wavenet.com.tw', name: 'Perci Kung', supervisorName: '江秉倫_Alan Chiang' },
    { email: 'wenfang.wang@partner.wavenet.com.tw', name: '王玟方Bobo', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'yuki.liu@wavenet.com.tw', name: '劉詠琪yuki', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'william.lai@wavenet.com.tw', name: '賴昱安_William Lai', supervisorName: '駱呈義_Joe' },
    { email: 'mandy.wu@wavenet.com.tw', name: '吳靜嫻_Mandy Wu', supervisorName: '林珊如_Nikki Lin' },
    { email: 'yansin.meng@wavenet.com.tw', name: '孟妍歆', supervisorName: '秋本康行_Yasuyuki Akimoto' },
    { email: 'chenyu.hsiao@wavenet.com.tw', name: '蕭禎祐', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'anita.chung@partner.wavenet.com.tw', name: '鍾曜安_Anita Chung', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'lisa.lin@wavenet.com.tw', name: '林雅涵_Lisa Lin', supervisorName: '江秉倫_Alan Chiang' },
    { email: 'shihyin.chou@wavenet.com.tw', name: '周詩縈_Shihyin Chou', supervisorName: '許瑜真_KJ Hsu' },
    { email: 'sabrina.lin@wavenet.com.tw', name: '林庭妤_Sabrina Lin', supervisorName: '許婷婷_Annie Hsu' },
    { email: 'sandy.wang@wavenet.com.tw', name: '王舒俞_Sandy Wang', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'nikki.lin@wavenet.com.tw', name: '林珊如_Nikki Lin', supervisorName: '' },
    { email: 'gr920418@gmail.com', name: '賴冠伶', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'liuchery10922@gmail.com', name: '劉宜宸_Chery Liu', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'jade.lin@wavenet.com.tw', name: '林子渟_Jade Lin', supervisorName: '許瑜真_KJ Hsu' },
    { email: 'vicky.ku@wavenet.com.tw', name: '文淇 Vicky Ku', supervisorName: '蔣耀庭_Peter Chiang' },
    { email: 'xiang.huang@wavenet.com.tw', name: '黃湘珺_Xiang Huang', supervisorName: '蔣耀庭_Peter Chiang' },
    { email: 'aki.akimoto@wavenet.com.tw', name: '秋本康行_Yasuyuki Akimoto', supervisorName: '' },
    { email: 'ashely.chiu@wavenet.com.tw', name: '邱巧聿_Ashely Chiu', supervisorName: '蔣耀庭_Peter Chiang' },
    { email: 'jp.chen@wavenet.com.tw', name: '陳江彬_JP Chen', supervisorName: '' },
    { email: 'rebekah.chiu@wavenet.com.tw', name: '邱琦雯_Rebekah Chiu', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'tim.huang@wavenet.com.tw', name: '黃亭遠_Tim Huang', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'leonard.li@wavenet.com.tw', name: '李政憲_Leonard Li', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'erin.yeh@wavenet.com.tw', name: '葉冠琳_Erin Yeh', supervisorName: '林啟耀_Ivan Lim' },
    { email: 'solution.intern01@wavenet.com.tw', name: '解方實習生', supervisorName: '黃千奕_Candy Huang' },
    { email: 'arvid.wang@wavenet.com.tw', name: '王瑋翔_Arvid Wang', supervisorName: '許婷婷_Annie Hsu' },
    { email: 'xhes.we.17@gmail.com', name: 'Yuki', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'a0909090524@gmail.com', name: '施允中', supervisorName: '黃千奕_Candy Huang' },
    { email: 'emma.fan@wavenet.com.tw', name: '范雅婷_Emma Fan', supervisorName: '江秉倫_Alan Chiang' },
    { email: 'hsin64michelle@gmail.com', name: '王律忻', supervisorName: '廖珮君_Peggy Liao' },
    { email: '960012jeffery@gmail.com', name: '王彥旻', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'andy.chen@wavenet.com.tw', name: '陳顯立_Andy Chen', supervisorName: '' },
    { email: 'aki.chang@wavenet.com.tw', name: '張家鈞_Aki Chang', supervisorName: '黃千奕_Candy Huang' },
    { email: 'jessica.yu@wavenet.com.tw', name: '游又蓁_Jessica', supervisorName: '林珊如_Nikki Lin' },
    { email: 'mou.wang@wavenet.com.tw', name: '王怡文_Mou Wang', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'chris.chiu@wavenet.com.tw', name: '邱映瑜_Chris', supervisorName: '江秉倫_Alan Chiang' },
    { email: 'pinjie.liu@wavenet.com.tw', name: '劉品婕_PinJie Liu', supervisorName: '' },
    { email: 'welson.huang@wavenet.com.tw', name: '黃翊瑋_Welson Huang', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'wenny.huang@wavenet.com.tw', name: '黃佩甯_Wenny Huang', supervisorName: '' },
    { email: 'kejichen20241017@gmail.com', name: '陳科輯', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'wolf19387@gmail.com', name: '林詠晴', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'sherry.hung@wavenet.com.tw', name: '洪梓瑄_Sherry Hung', supervisorName: '廖珮君_Peggy Liao' },
    { email: 'sammy.tseng@wavenet.com.tw', name: '曾姿然_Sammy Tseng', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'max.chang@wavenet.com.tw', name: '張丁元_Max Chang', supervisorName: '洪智傑_Chihchieh' },
    { email: 'sleep789988@yahoo.com.tw', name: '林義涵', supervisorName: '陳雅萍_MIMI Chen' },
    { email: 't0920400181@gmail.com', name: '蔣淑娟', supervisorName: '陳雅萍_MIMI Chen' },
    { email: 'sunny.wang@wavenet.com.tw', name: '王筱晴_Sunny Wang', supervisorName: '江秉倫_Alan Chiang' },
    { email: 'simon.csi@msa.hinet.net', name: '蔡信宏_Simon Csi', supervisorName: '江秉倫_Alan Chiang' },
    { email: 'kenneth.pan@wavenet.com.tw', name: '潘家銘_Kenneth Pan', supervisorName: '黃千奕_Candy Huang' },
    { email: 'luma.lii@wavenet.com.tw', name: '李沛彤_Luma Lii', supervisorName: '黃千奕_Candy Huang' },
    { email: 'bai.li@wavenet.com.tw', name: '李偉婷_Bai Li', supervisorName: '' },
    { email: 'sandy.tsai@wavenet.com.tw', name: '蔡美欣_Sandy Tsai', supervisorName: '' },
    { email: 'valis.chen@wavenet.com.tw', name: '陳詩寧_Valis Chen', supervisorName: '' },
    { email: 'Josh.Lin@wavenet.com.tw', name: '林正豪_Josh Lin', supervisorName: '張苡倢_Ivy Chang' },
    { email: 'wavenet_rd@wavenet.com.tw', name: 'Wavenet Admin', supervisorName: '' },
    { email: 'joey.chen@wavenet.com.tw', name: '陳聖佳_Joey Chen', supervisorName: '許瑜真_KJ Hsu' },
];

// 正規化名稱：取底線或空格前的中文部分，方便比對
function normalizeName(name: string): string {
    return name.split(/[_\s]/)[0].trim();
}

// 依姓名查找使用者（模糊比對：完整比對 → 正規化比對 → 包含比對）
export function findUserByName(sheetName: string): UserRecord | null {
    const cleanInput = sheetName.trim();
    if (!cleanInput) return null;

    // 1. 完整比對
    const exact = DIRECTORY.find(u => u.name === cleanInput);
    if (exact) return exact;

    // 2. 正規化比對（取底線前中文部分）
    const inputNorm = normalizeName(cleanInput);
    const norm = DIRECTORY.find(u => normalizeName(u.name) === inputNorm);
    if (norm) return norm;

    // 3. 包含比對（sheet 名稱是目錄名稱的子字串或反之）
    const partial = DIRECTORY.find(u =>
        u.name.includes(cleanInput) || cleanInput.includes(normalizeName(u.name))
    );
    return partial ?? null;
}

// 依主管名稱（supervisorName 欄）找主管 email
export function findSupervisorEmail(supervisorName: string): string | null {
    if (!supervisorName) return null;
    const supervisorNorm = normalizeName(supervisorName);
    const found = DIRECTORY.find(u => normalizeName(u.name) === supervisorNorm);
    return found?.email ?? null;
}

// 依 email 查找使用者（用於從派生 email 反查主管）
export function findUserByEmail(email: string): UserRecord | null {
    const lower = email.toLowerCase();
    return DIRECTORY.find(u => u.email.toLowerCase() === lower) ?? null;
}
