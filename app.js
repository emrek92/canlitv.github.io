document.addEventListener('DOMContentLoaded', () => {
    const channelsContainer = document.getElementById('channels');
    const videoPlayer = document.getElementById('videoPlayer');
    const currentChannel = document.getElementById('currentChannel');
    const searchInput = document.getElementById('searchInput');

    let channels = [];

    function playChannel(channel) {
        // Mevcut HLS instance'ı temizle
        if (window.hls) {
            window.hls.destroy();
        }

        // URL'yi kontrol et ve düzelt
        let streamUrl = channel.url.trim();
        
        // Konsola yayın bilgilerini yazdır (debug için)
        console.log('Oynatılmaya çalışılan kanal:', channel.name);
        console.log('Yayın URL:', streamUrl);

        try {
            if (streamUrl.includes('.m3u8')) {
                // HLS yayını
                if (Hls.isSupported()) {
                    window.hls = new Hls({
                        debug: true,
                        enableWorker: true,
                        lowLatencyMode: true,
                        backBufferLength: 90
                    });
                    
                    window.hls.loadSource(streamUrl);
                    window.hls.attachMedia(videoPlayer);
                    
                    window.hls.on(Hls.Events.MANIFEST_PARSED, function() {
                        videoPlayer.play().catch(function(error) {
                            console.log("Otomatik oynatma başarısız:", error);
                        });
                    });

                    window.hls.on(Hls.Events.ERROR, function(event, data) {
                        if (data.fatal) {
                            switch(data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    console.log("Ağ hatası, yeniden deneniyor...");
                                    window.hls.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    console.log("Medya hatası, kurtarılmaya çalışılıyor...");
                                    window.hls.recoverMediaError();
                                    break;
                                default:
                                    console.log("Kritik hata, yayın durduruluyor");
                                    window.hls.destroy();
                                    break;
                            }
                        }
                    });
                } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                    // Native HLS desteği (Safari)
                    videoPlayer.src = streamUrl;
                    videoPlayer.play();
                }
            } else {
                // Normal video stream (mp4, ts vb.)
                videoPlayer.src = streamUrl;
                videoPlayer.play().catch(function(error) {
                    console.log("Oynatma hatası:", error);
                });
            }

            currentChannel.textContent = channel.name;

            // Hata durumunda kullanıcıya bilgi ver
            videoPlayer.onerror = function() {
                console.log("Video oynatma hatası:", videoPlayer.error);
                currentChannel.textContent = `${channel.name} - Yayın başlatılamadı`;
            };

        } catch (error) {
            console.error("Kanal oynatma hatası:", error);
            currentChannel.textContent = "Yayın başlatılamadı";
        }
    }

    function parseM3U(data) {
        if (!data || typeof data !== 'string') {
            console.error('Geçersiz M3U verisi:', data);
            return [];
        }

        const lines = data.split('\n');
        const channels = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                try {
                    let channelInfo = {
                        name: '',
                        logo: '',
                        group: 'Diğer', // Varsayılan grup
                        url: ''
                    };

                    // İsim çıkarma
                    const nameMatch = line.match(/,(.*)$/);
                    if (nameMatch) {
                        channelInfo.name = nameMatch[1].trim();
                    }

                    // Logo çıkarma
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                    if (logoMatch) {
                        channelInfo.logo = logoMatch[1];
                    }

                    // Grup çıkarma
                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    if (groupMatch) {
                        channelInfo.group = groupMatch[1] || 'Diğer';
                    }

                    // URL'yi sonraki satırdan al
                    if (i + 1 < lines.length) {
                        const urlLine = lines[i + 1].trim();
                        if (urlLine && !urlLine.startsWith('#')) {
                            channelInfo.url = urlLine;
                            if (channelInfo.name && channelInfo.url) {
                                channels.push(channelInfo);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Kanal ayrıştırma hatası:', error);
                }
            }
        }
        return channels;
    }

    // Kanalları sırala
    function sortChannels(channelList) {
        const channelOrder = [
            // Ulusal Kanallar
            'TRT 1',
            'ATV',
            'Show TV',
            'Star TV',
            'Kanal D',
            'Fox TV',
            'TV8',
            'Kanal 7',
            'TRT 2',
            // Haber Kanalları
            'TRT Haber',
            'A Haber',
            'NTV',
            'CNN Türk',
            'Haber Türk',
            'Haber Global',
            'TGRT Haber',
            '24 TV',
            'TV100',
            'Bloomberg HT',
            'Ulusal Kanal'
        ];

        return channelList.sort((a, b) => {
            const orderA = channelOrder.indexOf(a.name);
            const orderB = channelOrder.indexOf(b.name);
            
            // Özel sıralamada varsa ona göre sırala
            if (orderA !== -1 && orderB !== -1) {
                return orderA - orderB;
            }
            
            // Sadece biri özel sıralamada varsa o önce gelsin
            if (orderA !== -1) return -1;
            if (orderB !== -1) return 1;
            
            // İkisi de özel sıralamada yoksa alfabetik sırala
            return a.name.localeCompare(b.name, 'tr');
        });
    }

    // Kanal listesini render et
    function renderChannels(channelsToRender) {
        channelsContainer.innerHTML = '';
        channelsToRender.forEach(channel => {
            const channelElement = document.createElement('div');
            channelElement.className = 'channel-item';
            channelElement.innerHTML = `
                <img class="channel-logo" src="${channel.logo}" onerror="this.src='placeholder.png'" alt="${channel.name}">
                <span>${channel.name}</span>
            `;
            channelElement.addEventListener('click', () => playChannel(channel));
            channelsContainer.appendChild(channelElement);
        });
    }

    // Arama işlevini güncelle
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredChannels = channels.filter(channel => 
            channel.name.toLowerCase().includes(searchTerm)
        );
        renderChannels(filteredChannels);
    });

    // Yükleme göstergesi fonksiyonları
    function showLoading() {
        channelsContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Kanal listesi yükleniyor...</p>
            </div>
        `;
    }

    // loadChannels fonksiyonunu güncelle
    async function loadChannels() {
        showLoading(); // Yükleme göstergesini göster
        
        try {
            const corsProxy = 'https://cors.eu.org/';
            
            // İlk kaynak
            console.log('İlk liste yükleniyor...');
            const response1 = await fetch(corsProxy + 
                'https://raw.githubusercontent.com/emrelinho1907/tvkanallari/refs/heads/main/türkliste.m3u');
            const data1 = await response1.text();
            const channels1 = parseM3U(data1);
            console.log('İlk listeden yüklenen kanal sayısı:', channels1.length);

            // İkinci kaynak (TVCDN)
            console.log('İkinci liste yükleniyor...');
            const response2 = await fetch(corsProxy + 'http://stream.tvcdn.net/lists/tr.m3u');
            const data2 = await response2.text();
            const channels2 = parseM3U(data2);
            console.log('İkinci listeden yüklenen kanal sayısı:', channels2.length);

            // Kanalları birleştir ve tekrarları önle
            const mergedChannels = mergeChannelLists(channels1, channels2);
            console.log('Birleştirilmiş kanal sayısı:', mergedChannels.length);
            
            // Kanalları sırala
            channels = sortChannels(mergedChannels);
            console.log('Toplam yüklenen kanal sayısı:', channels.length);
            renderChannels(channels);
        } catch (error) {
            console.error('Kanal listesi yüklenirken hata oluştu:', error);
            
            // Alternatif CORS proxy'leri dene
            try {
                console.log('Alternatif proxy deneniyor...');
                showLoading(); // Alternatif yükleme için göstergeyi tekrar göster
                
                const altProxy = 'https://api.allorigins.win/raw?url=';
                
                // İlk kaynak - alternatif
                const altResponse1 = await fetch(altProxy + 
                    encodeURIComponent('https://raw.githubusercontent.com/emrelinho1907/tvkanallari/refs/heads/main/türkliste.m3u'));
                const altData1 = await altResponse1.text();
                const altChannels1 = parseM3U(altData1);
                console.log('Alternatif: İlk listeden yüklenen kanal sayısı:', altChannels1.length);

                // İkinci kaynak - alternatif
                const altResponse2 = await fetch(altProxy + 
                    encodeURIComponent('http://stream.tvcdn.net/lists/tr.m3u'));
                const altData2 = await altResponse2.text();
                const altChannels2 = parseM3U(altData2);
                console.log('Alternatif: İkinci listeden yüklenen kanal sayısı:', altChannels2.length);

                // Birleştir ve işle
                const altMergedChannels = mergeChannelLists(altChannels1, altChannels2);
                const altSortedChannels = sortChannels(altMergedChannels);
                
                channels = altSortedChannels;
                console.log('Alternatif: Toplam yüklenen kanal sayısı:', channels.length);
                renderChannels(channels);
            } catch (altError) {
                console.error('Alternatif proxy de başarısız oldu:', altError);
                channelsContainer.innerHTML = `
                    <div class="error-container">
                        <p>Kanal listesi yüklenirken bir hata oluştu.</p>
                        <button onclick="location.reload()">Yeniden Dene</button>
                    </div>`;
            }
        }
    }

    // Kanal listelerini birleştir ve tekrarları önle
    function mergeChannelLists(list1, list2) {
        const uniqueChannels = new Map();
        
        // İlk listeyi ekle
        list1.forEach(channel => {
            uniqueChannels.set(channel.name, channel);
        });

        // İkinci listeyi ekle (aynı isimli kanalları güncelle)
        list2.forEach(channel => {
            if (!uniqueChannels.has(channel.name) || 
                (channel.url.includes('tvcdn.net') && !uniqueChannels.get(channel.name).url.includes('tvcdn.net'))) {
                uniqueChannels.set(channel.name, channel);
            }
        });

        return Array.from(uniqueChannels.values());
    }

    // Başlangıçta kanalları yükle
    loadChannels();
}); 