function normalizeMiddleEastBranding() {
    const replacements = [
        ['#brandTitle', 'عقارات الشرق الأوسط'],
        ['#footerBrandTitle', 'عقارات الشرق الأوسط']
    ];

    replacements.forEach(([selector, value]) => {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim() === 'سوريا العقارية') {
            element.textContent = value;
        }
    });

    const brandSubtitle = document.querySelector('#brandSubtitle');
    if (brandSubtitle && brandSubtitle.textContent.trim() === 'منصة استثمار عقاري رقمية') {
        brandSubtitle.textContent = 'منصة استثمار وعقارات رقمية للشرق الأوسط';
    }

    const headerNote = document.querySelector('.header-brand-note span');
    if (headerNote && headerNote.textContent.includes('الفرص العقارية')) {
        headerNote.textContent = 'واجهة أوضح لعرض فرص الاستثمار والعقارات في الشرق الأوسط';
    }

    const heroBadge = document.querySelector('#heroBadge');
    if (heroBadge) {
        const textNode = Array.from(heroBadge.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        if (textNode && textNode.textContent.includes('المحافظات السورية')) {
            textNode.textContent = ' فرص عقارية واستثمارية عبر الشرق الأوسط';
        }
    }

    const heroTitle = document.querySelector('#heroTitle');
    if (heroTitle && heroTitle.textContent.trim() === 'استثمر في عقارات سوريا برؤية أوضح وتجربة أحدث') {
        heroTitle.textContent = 'استثمر في عقارات الشرق الأوسط برؤية أوضح وتجربة أحدث';
    }

    const heroDescription = document.querySelector('#heroDescription');
    if (heroDescription && heroDescription.textContent.includes('حسب المحافظة')) {
        heroDescription.textContent = 'منصة رقمية تجمع المشاريع العقارية والعقارات المعروضة للبيع عبر مدن ومناطق الشرق الأوسط، مع صور أوضح ولوحة متابعة وتمويل من مكان واحد.';
    }

    const footerDescription = document.querySelector('#footerDescription');
    if (footerDescription && footerDescription.textContent.includes('المحافظات السورية')) {
        footerDescription.textContent = 'منصة استثمار وعقارات رقمية تعرض مشاريع وأسواق الشرق الأوسط بطريقة أوضح، مع إدارة المحافظ الرقمية والتمويل من واجهة واحدة.';
    }

    const titleParts = document.title.split('|').map((part) => part.trim());
    if (titleParts[0] === 'سوريا العقارية') {
        document.title = 'عقارات الشرق الأوسط | منصة استثمار وعقارات رقمية';
    }

    const applicationNameMeta = document.querySelector('meta[name="application-name"]');
    if (applicationNameMeta && applicationNameMeta.getAttribute('content') === 'سوريا العقارية') {
        applicationNameMeta.setAttribute('content', 'عقارات الشرق الأوسط');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    normalizeMiddleEastBranding();
    window.setTimeout(normalizeMiddleEastBranding, 300);
    window.setTimeout(normalizeMiddleEastBranding, 1200);
    window.setTimeout(normalizeMiddleEastBranding, 2500);
    window.setTimeout(normalizeMiddleEastBranding, 4000);
});
