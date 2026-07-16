import punycode from 'punycode/punycode.js';


/**
 * 将域名转换为适合界面展示的 Unicode 格式。
 *
 * 数据提交时仍应使用原始 Punycode，避免影响后端校验和域名匹配。
 */
export function formatDomain(domain) {
    if (typeof domain !== 'string' || !domain) return domain;

    const prefix = domain.startsWith('@') ? '@' : '';
    const rawDomain = prefix ? domain.slice(1) : domain;

    try {
        return prefix + punycode.toUnicode(rawDomain);
    } catch (error) {
        console.warn(`域名转换失败: ${domain}`, error);
        return domain;
    }
}


/**
 * 将邮箱域名转换为 Unicode，仅用于界面展示。
 */
export function formatEmail(email) {
    if (typeof email !== 'string' || !email) return email;

    const separatorIndex = email.lastIndexOf('@');
    if (separatorIndex < 0) return email;

    const emailName = email.slice(0, separatorIndex + 1);
    const domain = email.slice(separatorIndex + 1);
    return emailName + formatDomain(domain);
}
