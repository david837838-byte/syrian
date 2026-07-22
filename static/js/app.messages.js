        function playNotificationChime() {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const audioCtx = new AudioCtx();
                
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
                gain.gain.setValueAtTime(0, audioCtx.currentTime);
                gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
                
                osc.start(audioCtx.currentTime);
                osc.stop(audioCtx.currentTime + 0.16);

                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.08);
                gain2.gain.setValueAtTime(0, audioCtx.currentTime);
                gain2.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.10);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
                
                osc2.start(audioCtx.currentTime + 0.08);
                osc2.stop(audioCtx.currentTime + 0.36);
            } catch (e) {
                console.warn('Audio chime error:', e);
            }
        }

        function setMessageAttachmentStatus(message) {
            const el = $('#messageAttachmentStatus');
            if (el.length) {
                if (message && message.trim() !== '') {
                    el.text(message).css('display', 'block');
                } else {
                    el.text('').css('display', 'none');
                }
            }
        }

        function resetMessageAttachmentState() {
            appState.pendingMessageAttachment = null;
            $('#messageAttachmentInput').val('');
            setMessageAttachmentStatus('');
        }

        function getConversationDisplayName(conversation) {
            const counterpart = conversation?.counterpart || {};
            if (String(conversation?.kind || '') === 'support') {
                return 'الدعم والمساعدة';
            }
            return String(counterpart.name || conversation?.title || 'محادثة مباشرة').trim();
        }

        function setMessageRecipientSummary(conversation = null) {
            const wrap = $('#messageRecipientSummary');
            const name = $('#messageRecipientSummaryName');
            const meta = $('#messageRecipientSummaryMeta');
            const input = $('#messageRecipientPublicId');
            if (!wrap.length || !name.length || !meta.length || !input.length) {
                return;
            }

            if (!conversation || String(conversation.kind || '') !== 'direct' || !conversation.counterpart) {
                wrap.prop('hidden', true);
                name.text('لم يتم اختيار مستلم بعد');
                meta.text('بعد بدء المحادثة سيظهر الاسم هنا بدل رقم الحساب.');
                if (!String(input.val() || '').trim()) {
                    input.attr('placeholder', 'مثال: 100006');
                }
                return;
            }

            const counterpart = conversation.counterpart || {};
            wrap.prop('hidden', false);
            name.text(String(counterpart.name || 'مستخدم المنصة').trim());
            meta.text('تم فتح محادثة مباشرة مع هذا الحساب.');
            input.val('');
            input.attr('placeholder', `تم اختيار ${String(counterpart.name || 'المستخدم').trim()}`);
        }

        function buildConversationUnreadMap(conversations = []) {
            return (Array.isArray(conversations) ? conversations : []).reduce((result, conversation) => {
                result[String(conversation.id)] = Number(conversation.unread_count || 0);
                return result;
            }, {});
        }

        function getConversationMessageSummary(conversation) {
            const lastMessage = conversation?.last_message || {};
            if (String(lastMessage.message_type || '') === 'image') {
                return 'تم إرسال صورة داخل المحادثة.';
            }
            if (String(lastMessage.message_type || '') === 'audio') {
                return 'تم إرسال رسالة صوتية داخل المحادثة.';
            }
            return String(lastMessage.body || 'وصلك تحديث جديد داخل المحادثة.').trim();
        }

        function stopMessagesRealtime() {
            if (appState.messagesRealtimeTimer) {
                clearInterval(appState.messagesRealtimeTimer);
                appState.messagesRealtimeTimer = null;
            }
        }

        function stopMessagesHeartbeat() {
            if (appState.messagesHeartbeatTimer) {
                clearInterval(appState.messagesHeartbeatTimer);
                appState.messagesHeartbeatTimer = null;
            }
        }

        function startMessagesHeartbeat() {
            stopMessagesHeartbeat();
            if (!appState.currentUser) {
                return;
            }

            appState.messagesHeartbeatTimer = setInterval(async () => {
                if (document.hidden || appState.currentSection === 'messages' || appState.messagesRefreshInFlight) {
                    return;
                }
                if (appState.messagesRateLimitedUntil && Date.now() < appState.messagesRateLimitedUntil) {
                    return;
                }

                appState.messagesRefreshInFlight = true;
                try {
                    await loadConversations(appState.currentConversationId, {
                        silent: true,
                        skipConversationOpen: true
                    });
                } finally {
                    appState.messagesRefreshInFlight = false;
                }
            }, appState.messagesHeartbeatInterval);
        }

        function startMessagesRealtime() {
            stopMessagesRealtime();
            if (!appState.currentUser || appState.currentSection !== 'messages' || document.hidden) {
                return;
            }
            if (window.Notification && Notification.permission === "default") {
                Notification.requestPermission();
            }
            if (appState.messagesRateLimitedUntil && Date.now() < appState.messagesRateLimitedUntil) {
                return;
            }

            appState.messagesRealtimeTimer = setInterval(async () => {
                if (appState.messagesRefreshInFlight || appState.currentSection !== 'messages') {
                    return;
                }

                appState.messagesRefreshInFlight = true;
                try {
                    await refreshMessagesRealtime();
                } finally {
                    appState.messagesRefreshInFlight = false;
                }
            }, appState.messagesRealtimeInterval);
        }

        async function refreshMessagesRealtime() {
            if (appState.currentConversationId) {
                await openConversation(appState.currentConversationId, { silent: true });
                appState.messagesSidebarRefreshCounter = (appState.messagesSidebarRefreshCounter || 0) + 1;
                if (appState.messagesSidebarRefreshCounter % 3 === 0) {
                    await loadConversations(appState.currentConversationId, {
                        silent: true,
                        skipConversationOpen: true
                    });
                }
                return;
            }

            await loadConversations(null, {
                silent: true,
                skipConversationOpen: true
            });
        }

        async function loadConversations(selectConversationId = null, options = {}) {
            if (!appState.currentUser) {
                renderMessagesHeroPanel();
                return;
            }

            const silent = Boolean(options.silent);
            const skipConversationOpen = Boolean(options.skipConversationOpen);
            if (!silent) {
                showLoading();
            }

            try {
                const response = await apiRequest('/messages/conversations');
                if (response.success) {
                    const previousUnreadCount = Number(appState.lastUnreadMessagesCount || 0);
                    const previousUnreadMap = { ...(appState.lastConversationUnreadMap || {}) };
                    const previousIncomingCallSignature = String(appState.lastIncomingCallSignature || '');
                    appState.messagesRateLimitedUntil = 0;
                    appState.conversations = response.data.conversations || [];
                    renderConversations();
                    syncIncomingCallState();
                    notifyIncomingMessages(previousUnreadCount, previousUnreadMap, previousIncomingCallSignature, silent);

                    const nextConversationId = selectConversationId
                        || appState.currentConversationId
                        || appState.conversations[0]?.id;

                    if (!skipConversationOpen && nextConversationId) {
                        await openConversation(nextConversationId, { silent: true });
                    } else if (!nextConversationId) {
                        renderCurrentConversation(null, []);
                    }
                }
            } catch (error) {
                console.error('Load conversations error:', error);
                if (Number(error?.status) === 429) {
                    appState.messagesRateLimitedUntil = Date.now() + 60000;
                    stopMessagesRealtime();
                }
            } finally {
                if (!silent) {
                    hideLoading();
                }
            }
        }

        async function startConversation(targetType, recipientPublicId = '') {
            showLoading();
            try {
                const payload = targetType === 'support'
                    ? { target_type: 'support' }
                    : { target_type: 'user', recipient_public_id: recipientPublicId };
                const response = await apiRequest('/messages/conversations', 'POST', payload);
                if (response.success) {
                    const conversation = response.data.conversation;
                    toastr.success(response.message || 'تم فتح المحادثة');
                    setMessageRecipientSummary(conversation);
                    await loadConversations(conversation?.id, { silent: true });
                    showSection('messages');
                    return conversation || null;
                }
            } catch (error) {
                console.error('Start conversation error:', error);
                toastr.error(error.message || 'تعذر بدء المحادثة');
            } finally {
                hideLoading();
            }
            return null;
        }

        function notifyIncomingMessages(previousUnreadCount = 0, previousUnreadMap = {}, previousIncomingCallSignature = '', silent = false) {
            const unreadCount = appState.conversations.reduce((total, conversation) => {
                return total + Number(conversation.unread_count || 0);
            }, 0);

            const incomingCallIds = appState.conversations
                .filter(conversation => {
                    const call = conversation.active_call;
                    return call
                        && call.status === 'ringing'
                        && Number(call.initiated_by) !== Number(appState.currentUser?.id);
                })
                .map(conversation => String(conversation.active_call.id))
                .sort()
                .join(',');

            if (silent && previousUnreadCount >= 0 && unreadCount > previousUnreadCount) {
                const delta = unreadCount - previousUnreadCount;
                playNotificationChime();
                toastr.info(delta === 1 ? 'وصلك رسالة جديدة' : `وصلك ${delta.toLocaleString('ar-SA')} رسائل جديدة`);

                appState.conversations.forEach(conversation => {
                    const conversationId = String(conversation.id || '');
                    const previousCount = Number(previousUnreadMap[conversationId] || 0);
                    const currentCount = Number(conversation.unread_count || 0);
                    if (currentCount <= previousCount) {
                        return;
                    }
                    if (Number(appState.currentConversationId) === Number(conversation.id) && appState.currentSection === 'messages') {
                        return;
                    }

                    // Native browser push notification if tab is in the background
                    if (window.Notification && Notification.permission === "granted" && document.hidden) {
                        try {
                            new Notification(`رسالة جديدة من ${getConversationDisplayName(conversation)}`, {
                                body: getConversationMessageSummary(conversation),
                                icon: '/favicon.ico'
                            });
                        } catch (e) {
                            console.warn("Browser notification failed:", e);
                        }
                    }

                    if (typeof queueSiteNotification === 'function') {
                        queueSiteNotification({
                            key: `message:${conversation.id}:${currentCount}`,
                            level: 'primary',
                            title: `رسالة جديدة من ${getConversationDisplayName(conversation)}`,
                            body: getConversationMessageSummary(conversation),
                            section: 'messages',
                            conversationId: Number(conversation.id),
                            ttlMs: 20 * 60 * 1000
                        });
                    }
                });
            }

            if (silent && incomingCallIds && incomingCallIds !== previousIncomingCallSignature) {
                playNotificationChime();
                toastr.info('لديك اتصال وارد داخل الرسائل');
                const incomingConversation = appState.conversations.find(conversation => String(conversation.active_call?.id || '') === String(incomingCallIds.split(',')[0] || ''));
                if (incomingConversation && typeof queueSiteNotification === 'function') {
                    queueSiteNotification({
                        key: `call:${incomingConversation.active_call.id}`,
                        level: 'warning',
                        title: `اتصال وارد من ${getConversationDisplayName(incomingConversation)}`,
                        body: 'يمكنك فتح قسم الرسائل والرد مباشرة على الاتصال.',
                        section: 'messages',
                        conversationId: Number(incomingConversation.id),
                        ttlMs: 10 * 60 * 1000
                    });
                }
            }

            appState.lastUnreadMessagesCount = unreadCount;
            appState.lastConversationUnreadMap = buildConversationUnreadMap(appState.conversations);
            appState.lastIncomingCallSignature = incomingCallIds;
        }

        function hasMessagesListChanged(oldList, newList) {
            if (!oldList || !newList) return true;
            if (oldList.length !== newList.length) return true;
            for (let i = 0; i < oldList.length; i++) {
                if (Number(oldList[i].id) !== Number(newList[i].id) ||
                    oldList[i].body !== newList[i].body ||
                    oldList[i].is_deleted !== newList[i].is_deleted ||
                    oldList[i].attachment_url !== newList[i].attachment_url) {
                    return true;
                }
            }
            return false;
        }

        async function openConversation(conversationId, options = {}) {
            if (!conversationId) return;

            const silent = Boolean(options.silent);
            try {
                const response = await apiRequest(`/messages/conversations/${conversationId}`);
                if (response.success) {
                    appState.currentConversationId = conversationId;
                    appState.currentConversation = response.data.conversation;
                    
                    const newMessages = response.data.messages || [];
                    const oldMessages = appState.currentConversationMessages || [];
                    const messagesChanged = hasMessagesListChanged(oldMessages, newMessages);

                    if (oldMessages.length > 0 && newMessages.length > oldMessages.length) {
                        const lastNewMessage = newMessages[newMessages.length - 1];
                        const lastOldMessage = oldMessages[oldMessages.length - 1];
                        if (lastNewMessage.id > lastOldMessage.id && Number(lastNewMessage.sender_id) !== Number(appState.currentUser?.id)) {
                            playNotificationChime();
                        }
                    }

                    appState.currentConversationMessages = newMessages;
                    setMessageRecipientSummary(appState.currentConversation);
                    renderConversations();
                    
                    if (messagesChanged || !silent) {
                        renderCurrentConversation(appState.currentConversation, appState.currentConversationMessages);
                    }
                    syncCallStateWithConversation(appState.currentConversation);

                    const counterpart = appState.currentConversation?.counterpart || {};
                    if (appState.currentConversation.kind === 'direct' && counterpart.id) {
                        $('#viewChatCounterpartProfileBtn').show();
                    } else {
                        $('#viewChatCounterpartProfileBtn').hide();
                    }

                    if (!silent) {
                        startMessagesRealtime();
                    }
                }
            } catch (error) {
                console.error('Open conversation error:', error);
                if (Number(error?.status) === 429) {
                    appState.messagesRateLimitedUntil = Date.now() + 60000;
                    stopMessagesRealtime();
                }
            }
        }

        function renderConversations() {
            const container = $('#conversationsList');
            if (!container.length) return;

                if (!appState.conversations.length) {
                    container.html(`
                        <div class="transactions-empty-state">
                            <i class="fas fa-comments"></i>
                            <h4>لا توجد محادثات بعد</h4>
                        </div>
                    `);
                    renderMessagesHeroPanel();
                    return;
                }

            container.html(appState.conversations.map(conversation => {
                const counterpart = conversation.counterpart || {};
                const lastMessage = conversation.last_message;
                const isActive = Number(appState.currentConversationId) === Number(conversation.id);
                const label = conversation.kind === 'support'
                    ? 'الدعم والمساعدة'
                    : (counterpart.name || conversation.title || 'محادثة مباشرة');
                const avatarSeed = conversation.kind === 'support'
                    ? 'دع'
                    : String(label || '؟').trim().slice(0, 1);
                const summary = lastMessage?.body
                    || (lastMessage?.message_type === 'image' ? 'صورة مرفقة' : (lastMessage?.message_type === 'audio' ? 'رسالة صوتية' : 'لا توجد رسائل بعد'));
                const time = lastMessage?.created_at || conversation.updated_at || '';
                const unreadCount = Number(conversation.unread_count || 0);
                const callMeta = conversation.active_call
                    ? getCallStateMeta(conversation.active_call, {
                        incoming: Number(conversation.active_call.initiated_by) !== Number(appState.currentUser?.id)
                    })
                    : null;
                const callChip = callMeta
                    ? `<span class="conversation-list-item__call is-${sanitizeHtml(callMeta.key)}"><i class="fas fa-phone-volume"></i> ${sanitizeHtml(callMeta.shortLabel)}</span>`
                    : '';
                return `
                    <button type="button" class="conversation-list-item ${isActive ? 'is-active' : ''}" data-id="${conversation.id}">
                        <div class="conversation-list-item__avatar">${sanitizeHtml(avatarSeed)}</div>
                        <div class="conversation-list-item__content">
                            <div class="conversation-list-item__topline">
                                <strong>${sanitizeHtml(label)}</strong>
                                <time>${sanitizeHtml(time)}</time>
                            </div>
                            <span>${sanitizeHtml(summary)}</span>
                            <div class="conversation-list-item__meta">
                                ${callChip}
                                ${unreadCount > 0 ? `<span class="conversation-list-item__badge">${unreadCount}</span>` : '<span></span>'}
                            </div>
                        </div>
                    </button>
                `;
            }).join(''));

            $('.conversation-list-item').off('click').on('click', function() {
                openConversation($(this).data('id'));
            });

            renderMessagesHeroPanel();
        }

        function renderCurrentConversation(conversation, messages) {
            const title = $('#messagesCurrentConversationTitle');
            const meta = $('#messagesCurrentConversationMeta');
            const thread = $('#messagesThread');
            const avatar = $('#messagesCurrentAvatar');
            if (!title.length || !meta.length || !thread.length) return;

            if (!conversation) {
                appState.currentConversationId = null;
                appState.currentConversation = null;
                appState.currentConversationMessages = [];
                setMessageRecipientSummary(null);
                $('#viewChatCounterpartProfileBtn').hide();
                if (avatar.length) {
                    avatar.text('؟');
                }
                title.html('<i class="fas fa-comment-dots"></i> اختر محادثة');
                meta.text('ستظهر الرسائل هنا بعد اختيار المحادثة أو بدء واحدة جديدة.');
                thread.html(`
                    <div class="transactions-empty-state">
                        <i class="fas fa-paper-plane"></i>
                        <h4>لا توجد محادثة نشطة الآن</h4>
                    </div>
                `);
                updateCallControls();
                return;
            }

            const counterpart = conversation.counterpart || {};
            setMessageRecipientSummary(conversation);
            if (avatar.length) {
                avatar.text(conversation.kind === 'support' ? 'دع' : String(counterpart.name || conversation.title || '؟').trim().slice(0, 1));
            }
            title.html(`<i class="fas fa-comment-dots"></i> ${sanitizeHtml(conversation.kind === 'support' ? 'الدعم والمساعدة' : (counterpart.name || conversation.title || 'محادثة'))}`);
            meta.text(conversation.kind === 'support'
                ? 'يمكنك مراسلة الإدارة مباشرة من هنا ورفع صورة أو رسالة صوتية أو بدء اتصال صوتي إذا لزم.'
                : `محادثة مباشرة مع ${counterpart.name || 'هذا المستخدم'} من داخل المنصة.`);

            updateCallControls();

            if (!messages || !messages.length) {
                thread.html(`
                    <div class="transactions-empty-state">
                        <i class="fas fa-comment-slash"></i>
                        <h4>ابدأ أول رسالة في هذه المحادثة</h4>
                    </div>
                `);
                return;
            }

            thread.html(messages.map(message => {
                const origin = String(message.message_origin || 'user').trim().toLowerCase();
                const isAssistant = origin === 'assistant';
                const mine = Number(message.sender_id) === Number(appState.currentUser?.id) && !isAssistant;
                const body = sanitizeHtml(message.body || '');
                const deleteAction = mine
                    ? `<button type="button" class="message-bubble__action" data-delete-message-id="${message.id}" title="حذف لدى الجميع" aria-label="حذف الرسالة لدى الجميع"><i class="fas fa-trash"></i></button>`
                    : '';
                let attachmentHtml = '';
                if (message.attachment_url) {
                    if (message.message_type === 'image') {
                        attachmentHtml = `<img src="${sanitizeHtml(message.attachment_url)}" alt="attachment" class="message-attachment-image">`;
                    } else if (message.message_type === 'audio') {
                        attachmentHtml = `<audio controls class="message-attachment-audio"><source src="${sanitizeHtml(message.attachment_url)}"></audio>`;
                    }
                }

                const senderLabel = isAssistant
                    ? sanitizeHtml(getSettingValue('support_ai_name', 'مساعد المنصة الذكي'))
                    : sanitizeHtml(mine ? 'أنت' : (message.sender_name || ''));

                const stateHtml = mine
                    ? `
                            <span class="message-bubble__state ${message.read_at ? 'is-read' : ''}">
                                <i class="fas ${message.read_at ? 'fa-check-double' : 'fa-check'}"></i>
                                ${message.read_at ? 'مقروءة' : 'مرسلة'}
                            </span>
                    `
                    : '';

                return `
                    <div class="message-bubble ${mine ? 'is-mine' : ''}">
                        <div class="message-bubble__actions">
                            ${deleteAction}
                        </div>
                        <div class="message-bubble__sender">${senderLabel}</div>
                        ${body ? `<div class="message-bubble__body">${body}</div>` : ''}
                        ${attachmentHtml}
                        <div class="message-bubble__footer">
                            ${stateHtml}
                            <div class="message-bubble__time">${sanitizeHtml(message.created_at || '')}</div>
                        </div>
                    </div>
                `;
            }).join(''));
            thread.scrollTop(thread[0].scrollHeight);
            renderMessagesHeroPanel();
        }

        function updateVoiceRecordingUi() {
            const isRecording = Boolean(appState.isRecordingVoice);
            $('#startVoiceRecordingBtn').prop('hidden', isRecording);
            $('#stopVoiceRecordingBtn').prop('hidden', !isRecording);
            $('#messagesHeroVoiceState').text(isRecording ? 'جارٍ التسجيل' : 'جاهزة');
        }

        function updateVoiceRecordingStatus() {
            if (!appState.voiceRecordingStartedAt) {
                return;
            }
            const elapsedMs = Date.now() - appState.voiceRecordingStartedAt;
            const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
            const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            setMessageAttachmentStatus(`جاري تسجيل الرسالة الصوتية... ${minutes}:${seconds}`);
        }

        async function startVoiceRecording() {
            if (appState.isRecordingVoice) {
                return;
            }
            if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
                toastr.warning('التسجيل الصوتي غير مدعوم على هذا المتصفح');
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : '');

                appState.mediaRecorderStream = stream;
                appState.mediaRecorderChunks = [];
                appState.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
                appState.mediaRecorder.ondataavailable = event => {
                    if (event.data && event.data.size > 0) {
                        appState.mediaRecorderChunks.push(event.data);
                    }
                };
                appState.mediaRecorder.start();
                appState.isRecordingVoice = true;
                appState.voiceRecordingStartedAt = Date.now();
                updateVoiceRecordingUi();
                updateVoiceRecordingStatus();
                appState.voiceRecordingTimer = setInterval(updateVoiceRecordingStatus, 1000);
            } catch (error) {
                console.error('Start voice recording error:', error);
                const denied = String(error?.name || '').toLowerCase().includes('notallowed');
                toastr.error(denied ? 'تم رفض إذن الميكروفون. اسمح للمتصفح باستخدامه ثم حاول مجددًا.' : 'تعذر بدء التسجيل الصوتي');
            }
        }

        function stopVoiceStream() {
            if (appState.mediaRecorderStream) {
                appState.mediaRecorderStream.getTracks().forEach(track => track.stop());
                appState.mediaRecorderStream = null;
            }
        }

        async function stopVoiceRecordingAndUpload(options = {}) {
            if (!appState.mediaRecorder || !appState.isRecordingVoice) {
                return;
            }

            const autoSend = Boolean(options.autoSend);

            const recorder = appState.mediaRecorder;
            await new Promise(resolve => {
                recorder.onstop = resolve;
                recorder.stop();
            });

            appState.isRecordingVoice = false;
            appState.mediaRecorder = null;
            clearInterval(appState.voiceRecordingTimer);
            appState.voiceRecordingTimer = null;
            appState.voiceRecordingStartedAt = null;
            updateVoiceRecordingUi();
            stopVoiceStream();

            try {
                const blobType = appState.mediaRecorderChunks[0]?.type || 'audio/webm';
                const extension = blobType.includes('ogg') ? 'ogg' : 'webm';
                const blob = new Blob(appState.mediaRecorderChunks, { type: blobType });
                const file = new File([blob], `voice-message.${extension}`, { type: blobType });
                setMessageAttachmentStatus('جاري رفع الرسالة الصوتية...');
                const upload = await uploadMessageAttachment(file);
                appState.pendingMessageAttachment = upload;
                setMessageAttachmentStatus('تم تجهيز الرسالة الصوتية للإرسال');
                if (autoSend) {
                    $('#sendConversationMessageBtn').trigger('click');
                }
            } catch (error) {
                console.error('Voice upload error:', error);
                appState.pendingMessageAttachment = null;
                setMessageAttachmentStatus('تعذر رفع الرسالة الصوتية المسجلة.');
                toastr.error(error.message || 'تعذر تجهيز الرسالة الصوتية');
            } finally {
                appState.mediaRecorderChunks = [];
            }
        }

        function updateCallControls() {
            const activeCallForConversation = appState.currentConversation?.active_call;
            const showEnd = Boolean(activeCallForConversation && ['ringing', 'active'].includes(activeCallForConversation.status));
            $('#startAudioCallBtn').prop('hidden', showEnd || !appState.currentConversationId);
            $('#endAudioCallBtn').prop('hidden', !showEnd);
        }

        function getCallPermissionMessage(error, fallback = 'تعذر الوصول إلى الميكروفون لبدء الاتصال') {
            const errorName = String(error?.name || '').toLowerCase();
            if (errorName.includes('notallowed') || errorName.includes('permissiondenied')) {
                return 'تم رفض إذن الميكروفون. اسمح للمتصفح باستخدام الميكروفون ثم أعد المحاولة.';
            }
            if (errorName.includes('notfound') || errorName.includes('devicesnotfound')) {
                return 'لم يتم العثور على ميكروفون متاح على هذا الجهاز.';
            }
            if (errorName.includes('notreadable') || errorName.includes('trackstart')) {
                return 'الميكروفون مشغول الآن من تطبيق آخر. أغلقه ثم حاول مجددًا.';
            }
            return fallback;
        }

        function updateCallMediaControls() {
            const call = appState.activeCall || appState.currentConversation?.active_call || null;
            const showMediaControls = Boolean(call && ['ringing', 'active'].includes(String(call.status || '').toLowerCase()));
            const muteBtn = $('#toggleMuteCallBtn');
            const speakerBtn = $('#toggleSpeakerCallBtn');

            muteBtn.prop('hidden', !showMediaControls);
            speakerBtn.prop('hidden', !showMediaControls);

            muteBtn.toggleClass('is-active', Boolean(appState.callMicMuted));
            speakerBtn.toggleClass('is-active', Boolean(appState.callSpeakerEnabled));

            muteBtn.html(appState.callMicMuted
                ? '<i class="fas fa-microphone-slash"></i><span>إلغاء الكتم</span>'
                : '<i class="fas fa-microphone"></i><span>كتم الميكروفون</span>');

            speakerBtn.html(appState.callSpeakerEnabled
                ? '<i class="fas fa-volume-high"></i><span>مكبر الصوت</span>'
                : '<i class="fas fa-volume-xmark"></i><span>الصوت مغلق</span>');

            if (appState.localCallStream) {
                appState.localCallStream.getAudioTracks().forEach(track => {
                    track.enabled = !appState.callMicMuted;
                });
            }

            const remoteAudio = $('#remoteCallAudio').get(0);
            if (remoteAudio) {
                remoteAudio.muted = !appState.callSpeakerEnabled;
                remoteAudio.volume = appState.callSpeakerEnabled ? 1 : 0;
            }
        }

        async function toggleCallSpeaker() {
            appState.callSpeakerEnabled = !appState.callSpeakerEnabled;
            updateCallMediaControls();

            const remoteAudio = $('#remoteCallAudio').get(0);
            if (remoteAudio && typeof remoteAudio.setSinkId === 'function' && appState.callSpeakerEnabled) {
                try {
                    await remoteAudio.setSinkId('default');
                } catch (error) {
                    console.error('Set speaker output error:', error);
                }
            }
        }

        function toggleCallMicrophone() {
            if (!appState.localCallStream) {
                toastr.info('سيتفعّل التحكم بالميكروفون فور بدء الاتصال.');
                return;
            }
            appState.callMicMuted = !appState.callMicMuted;
            updateCallMediaControls();
        }

        async function ensureRtcConfig() {
            if (appState.rtcConfig?.iceServers?.length) {
                return appState.rtcConfig;
            }

            const fallback = {
                iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
                turnEnabled: false,
                turnConfigured: false
            };

            try {
                const response = await apiRequest('/messages/rtc-config');
                if (response?.success) {
                    const stunUrls = Array.isArray(response.data?.stun_urls) && response.data.stun_urls.length
                        ? response.data.stun_urls
                        : ['stun:stun.l.google.com:19302'];
                    appState.rtcConfig = {
                        iceServers: [{ urls: stunUrls }],
                        turnEnabled: Boolean(response.data?.turn_enabled),
                        turnConfigured: Boolean(response.data?.turn_configured)
                    };
                    return appState.rtcConfig;
                }
            } catch (error) {
                console.error('Load RTC config error:', error);
            }

            appState.rtcConfig = fallback;
            return fallback;
        }

        async function playAudioElementSafely(element) {
            if (!element || typeof element.play !== 'function') {
                return;
            }
            try {
                const playPromise = element.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    await playPromise.catch(error => {
                        console.error('Audio autoplay error:', error);
                    });
                }
            } catch (error) {
                console.error('Audio play error:', error);
            }
        }

        function getCallStateMeta(call, options = {}) {
            const incoming = Boolean(options.incoming);
            const phase = String(options.phase || '').trim().toLowerCase();
            const status = String(call?.status || '').trim().toLowerCase();

            if (phase === 'dialing') {
                return {
                    key: 'dialing',
                    shortLabel: 'يتصل الآن',
                    statusText: 'يتم الآن بدء الاتصال وتجهيز الصوت.'
                };
            }

            if (phase === 'connecting') {
                return {
                    key: 'connecting',
                    shortLabel: 'يتم الربط',
                    statusText: 'تم الرد، وجارٍ الآن ربط الصوت بين الطرفين.'
                };
            }

            if (status === 'active') {
                return {
                    key: 'active',
                    shortLabel: 'متصل الآن',
                    statusText: 'تم الرد على الاتصال، ويمكنكما التحدث الآن.'
                };
            }

            if (status === 'ringing') {
                if (incoming) {
                    return {
                        key: 'incoming',
                        shortLabel: 'اتصال وارد',
                        statusText: 'يتصل بك الآن. يمكنك القبول أو الرفض مباشرة.'
                    };
                }

                return {
                    key: 'ringing',
                    shortLabel: 'يرن الآن',
                    statusText: 'يرن الآن عند الطرف الآخر. بانتظار الرد.'
                };
            }

            if (status === 'rejected') {
                return {
                    key: 'rejected',
                    shortLabel: 'مرفوض',
                    statusText: 'تم رفض الاتصال.'
                };
            }

            if (status === 'ended') {
                return {
                    key: 'ended',
                    shortLabel: 'انتهى',
                    statusText: 'انتهت المكالمة.'
                };
            }

            return {
                key: 'idle',
                shortLabel: 'اتصال',
                statusText: 'لا يوجد اتصال نشط الآن.'
            };
        }

        function updateCallOverlay(call, overrides = {}) {
            const overlay = $('#callOverlay');
            const title = $('#callOverlayTitle');
            const status = $('#callOverlayStatus');
            const avatar = $('#callOverlayAvatar');
            const badge = $('#callOverlayBadgeText');
            const isIncoming = Boolean(overrides.incoming);
            const counterpart = appState.currentConversation?.counterpart || {};
            const displayName = overrides.name || call?.initiator_name || counterpart.name || 'مستخدم المنصة';
            const meta = getCallStateMeta(call, {
                incoming: isIncoming,
                phase: overrides.phase
            });

            overlay.prop('hidden', false);
            overlay.attr('data-call-status', meta.key);
            avatar.text(String(displayName || '؟').trim().slice(0, 1));
            title.text(displayName);
            badge.text(call?.call_type === 'audio' ? `${meta.shortLabel}` : 'اتصال');
            status.text(overrides.statusText || meta.statusText);
            $('#rejectIncomingCallBtn').html(
                isIncoming
                    ? '<i class="fas fa-phone-slash"></i> رفض'
                    : '<i class="fas fa-xmark"></i> إلغاء الاتصال'
            );
            $('#acceptIncomingCallBtn').prop('hidden', !isIncoming);
            $('#rejectIncomingCallBtn').prop('hidden', !isIncoming && call?.status === 'active');
            $('#overlayEndCallBtn').prop('hidden', call?.status !== 'active');
            $('#closeCallOverlayBtn').prop('hidden', ['ringing', 'active'].includes(call?.status));
            updateCallMediaControls();
        }

        function hideCallOverlay() {
            $('#callOverlay').prop('hidden', true);
            $('#callOverlay').attr('data-call-status', 'idle');
            $('#acceptIncomingCallBtn, #rejectIncomingCallBtn, #overlayEndCallBtn, #closeCallOverlayBtn, #toggleMuteCallBtn, #toggleSpeakerCallBtn').prop('hidden', true);
        }

        function stopCallPolling() {
            if (appState.callPollingTimer) {
                clearInterval(appState.callPollingTimer);
                appState.callPollingTimer = null;
            }
        }

        async function cleanupCallResources(resetState = true) {
            stopCallPolling();

            if (appState.peerConnection) {
                try {
                    appState.peerConnection.onicecandidate = null;
                    appState.peerConnection.ontrack = null;
                    appState.peerConnection.onconnectionstatechange = null;
                    appState.peerConnection.oniceconnectionstatechange = null;
                    appState.peerConnection.close();
                } catch (error) {
                    console.error('Peer close error:', error);
                }
                appState.peerConnection = null;
            }

            if (appState.localCallStream) {
                appState.localCallStream.getTracks().forEach(track => track.stop());
                appState.localCallStream = null;
            }

            if (appState.remoteCallStream) {
                appState.remoteCallStream.getTracks().forEach(track => track.stop());
                appState.remoteCallStream = null;
            }

            const remoteAudio = $('#remoteCallAudio').get(0);
            const localAudio = $('#localCallAudio').get(0);
            if (remoteAudio) {
                remoteAudio.srcObject = null;
            }
            if (localAudio) {
                localAudio.srcObject = null;
            }

            if (resetState) {
                appState.activeCall = null;
                appState.callLastSignalId = 0;
                appState.pendingIncomingCallId = null;
                appState.callMicMuted = false;
                appState.callSpeakerEnabled = true;
                updateCallControls();
                updateCallMediaControls();
            }
        }

        async function ensureLocalCallStream() {
            if (appState.localCallStream) {
                return appState.localCallStream;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            appState.localCallStream = stream;
            stream.getAudioTracks().forEach(track => {
                track.enabled = !appState.callMicMuted;
            });
            const localAudio = $('#localCallAudio').get(0);
            if (localAudio) {
                localAudio.srcObject = stream;
                localAudio.muted = true;
                await playAudioElementSafely(localAudio);
            }
            return stream;
        }

        async function ensurePeerConnection(callId) {
            if (appState.peerConnection) {
                return appState.peerConnection;
            }

            const rtcConfig = await ensureRtcConfig();

            const peer = new RTCPeerConnection({
                iceServers: rtcConfig.iceServers
            });

            peer.iceCandidateQueue = [];

            peer.onicecandidate = async event => {
                if (event.candidate && appState.activeCall?.id === callId) {
                    try {
                        await apiRequest(`/messages/calls/${callId}/signal`, 'POST', {
                            signal_type: 'ice-candidate',
                            payload: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
                        });
                    } catch (error) {
                        console.error('ICE candidate send error:', error);
                    }
                }
            };

            peer.ontrack = event => {
                const remoteAudio = $('#remoteCallAudio').get(0);
                if (remoteAudio) {
                    const stream = (event.streams && event.streams[0]) ? event.streams[0] : null;
                    if (stream) {
                        remoteAudio.srcObject = stream;
                    } else {
                        if (!appState.remoteCallStream) {
                            appState.remoteCallStream = new MediaStream();
                        }
                        const exists = appState.remoteCallStream.getTracks().some(existingTrack => existingTrack.id === event.track.id);
                        if (!exists) {
                            appState.remoteCallStream.addTrack(event.track);
                        }
                        remoteAudio.srcObject = appState.remoteCallStream;
                    }
                    remoteAudio.muted = !appState.callSpeakerEnabled;
                    remoteAudio.volume = appState.callSpeakerEnabled ? 1 : 0;
                    playAudioElementSafely(remoteAudio);
                }
                updateCallOverlay(appState.activeCall, { statusText: 'تم ربط الصوت بنجاح ويمكنكما التحدث الآن.' });
            };

            peer.onconnectionstatechange = () => {
                const state = String(peer.connectionState || '').toLowerCase();
                if (state === 'connected') {
                    updateCallOverlay(appState.activeCall, {
                        phase: 'active',
                        statusText: 'تم الاتصال بنجاح ويمكنكما التحدث الآن.'
                    });
                } else if (state === 'connecting') {
                    updateCallOverlay(appState.activeCall, {
                        phase: 'connecting',
                        statusText: 'جارٍ الآن تثبيت الاتصال ونقل الصوت.'
                    });
                } else if (state === 'failed') {
                    updateCallOverlay(appState.activeCall, {
                        statusText: 'فشل ربط الصوت بين الطرفين. جرّب إنهاء الاتصال ثم إعادة المحاولة.'
                    });
                    toastr.error('فشل ربط الصوت بين الطرفين. جرّب الاتصال مرة أخرى.');
                } else if (state === 'disconnected') {
                    updateCallOverlay(appState.activeCall, {
                        statusText: 'انقطع الاتصال مؤقتًا. نحاول إعادة الربط.'
                    });
                }
            };

            peer.oniceconnectionstatechange = () => {
                const state = String(peer.iceConnectionState || '').toLowerCase();
                if (state === 'failed') {
                    updateCallOverlay(appState.activeCall, {
                        statusText: rtcConfig.turnEnabled && rtcConfig.turnConfigured
                            ? 'تعذر تثبيت مسار الصوت رغم وجود إعدادات TURN. راجع بيانات الخادم أو جرّب مجددًا.'
                            : 'تعذر تثبيت مسار الصوت. إذا كان كل طرف على شبكة مختلفة فقد نحتاج خادم TURN لاحقًا.'
                    });
                }
            };

            const stream = await ensureLocalCallStream();
            stream.getTracks().forEach(track => peer.addTrack(track, stream));
            appState.peerConnection = peer;
            return peer;
        }

        function syncCallStateWithConversation(conversation) {
            if (!conversation) {
                updateCallControls();
                return;
            }

            const activeCall = conversation.active_call || null;
            if (!activeCall) {
                if (appState.activeCall && Number(appState.activeCall.conversation_id) === Number(conversation.id)) {
                    cleanupCallResources();
                    hideCallOverlay();
                }
                updateCallControls();
                return;
            }

            appState.activeCall = activeCall;
            updateCallControls();

            const isIncoming = Number(activeCall.initiated_by) !== Number(appState.currentUser?.id)
                && activeCall.status === 'ringing';

            if (isIncoming || activeCall.status === 'active' || Number(activeCall.initiated_by) === Number(appState.currentUser?.id)) {
                updateCallOverlay(activeCall, {
                    incoming: isIncoming,
                    name: conversation.kind === 'support'
                        ? 'الدعم والمساعدة'
                        : (conversation.counterpart?.name || conversation.title || 'مستخدم المنصة')
                });
            }

            startCallPolling(activeCall.id);
        }

        function syncIncomingCallState() {
            const incomingConversation = appState.conversations.find(conversation => {
                const call = conversation.active_call;
                return call
                    && call.status === 'ringing'
                    && Number(call.initiated_by) !== Number(appState.currentUser?.id);
            });

            if (incomingConversation && Number(appState.pendingIncomingCallId) !== Number(incomingConversation.active_call.id)) {
                appState.pendingIncomingCallId = incomingConversation.active_call.id;
                appState.activeCall = incomingConversation.active_call;
                updateCallOverlay(incomingConversation.active_call, {
                    incoming: true,
                    name: incomingConversation.kind === 'support'
                        ? 'الدعم والمساعدة'
                        : (incomingConversation.counterpart?.name || incomingConversation.title || 'مستخدم المنصة')
                });
                toastr.info('لديك اتصال وارد داخل الرسائل');
            }
        }

        async function startCallPolling(callId) {
            if (!callId) {
                return;
            }

            stopCallPolling();
            appState.callPollingTimer = setInterval(async () => {
                try {
                    const response = await apiRequest(`/messages/calls/${callId}/signals?after_id=${appState.callLastSignalId}`);
                    if (!response.success) {
                        return;
                    }

                    const call = response.data.call;
                    if (!call) {
                        return;
                    }

                    appState.activeCall = call;

                    // Timeout check for caller (no answer after 35 seconds)
                    if (call.status === 'ringing' && Number(call.initiated_by) === Number(appState.currentUser?.id)) {
                        const elapsedSec = (Date.now() - (appState.callStartedLocalTime || Date.now())) / 1000;
                        if (elapsedSec > 35) {
                            toastr.info('لم يتم الرد من الطرف الآخر');
                            await endCurrentCall('end');
                            return;
                        }
                    }

                    if (appState.currentConversation && Number(appState.currentConversation.id) === Number(call.conversation_id)) {
                        appState.currentConversation.active_call = call;
                    }

                    const activeConversation = appState.conversations.find(conversation => Number(conversation.id) === Number(call.conversation_id));
                    const isIncoming = Number(call.initiated_by) !== Number(appState.currentUser?.id);
                    updateCallOverlay(call, {
                        incoming: isIncoming,
                        name: activeConversation?.kind === 'support'
                            ? 'الدعم والمساعدة'
                            : (activeConversation?.counterpart?.name || activeConversation?.title || 'مستخدم المنصة')
                    });

                    if (!['ringing', 'active'].includes(call.status)) {
                        if (appState.currentConversation) {
                            appState.currentConversation.active_call = null;
                        }
                        updateCallOverlay(call, {
                            statusText: call.status === 'rejected'
                                ? 'تم رفض الاتصال.'
                                : (call.status === 'ended' ? 'انتهى الاتصال.' : 'لم يتم الرد.')
                        });
                        $('#closeCallOverlayBtn').prop('hidden', false);
                        await cleanupCallResources(false);
                        updateCallControls();

                        // Missed call notification for receiver
                        if (isIncoming && call.status === 'ended') {
                            toastr.info('مكالمة فائتة من الطرف الآخر');
                            if (typeof queueSiteNotification === 'function') {
                                queueSiteNotification({
                                    key: `missed-call:${call.id}`,
                                    level: 'danger',
                                    title: 'مكالمة فائتة',
                                    body: `لديك مكالمة فائتة لم يرد عليها من ${activeConversation?.counterpart?.name || 'الطرف الآخر'}.`,
                                    section: 'messages',
                                    ttlMs: 10 * 60 * 1000
                                });
                            }
                        }
                        return;
                    }

                    const signals = response.data.signals || [];
                    for (const signal of signals) {
                        appState.callLastSignalId = Math.max(appState.callLastSignalId, Number(signal.id || 0));
                        if (Number(signal.sender_id) === Number(appState.currentUser?.id)) {
                            continue;
                        }
                        await handleIncomingSignal(signal);
                    }
                } catch (error) {
                    console.error('Call polling error:', error);
                }
            }, 3000);
        }

        async function processIceQueue(peer) {
            if (peer.iceCandidateQueue && peer.iceCandidateQueue.length > 0) {
                const queue = [...peer.iceCandidateQueue];
                peer.iceCandidateQueue = [];
                for (const candidate of queue) {
                    try {
                        await peer.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error('Process ICE queue error:', e);
                    }
                }
            }
        }

        async function handleIncomingSignal(signal) {
            const callId = appState.activeCall?.id;
            if (!callId || !signal?.payload) {
                return;
            }

            const peer = await ensurePeerConnection(callId);
            const payload = signal.payload;

            if (signal.signal_type === 'offer') {
                if (!peer.currentRemoteDescription) {
                    await peer.setRemoteDescription(new RTCSessionDescription(payload));
                    await processIceQueue(peer);
                }
                if (!peer.currentLocalDescription) {
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    await apiRequest(`/messages/calls/${callId}/signal`, 'POST', {
                        signal_type: 'answer',
                        payload: peer.localDescription.toJSON ? peer.localDescription.toJSON() : peer.localDescription
                    });
                }
            } else if (signal.signal_type === 'answer') {
                if (!peer.currentRemoteDescription) {
                    await peer.setRemoteDescription(new RTCSessionDescription(payload));
                    await processIceQueue(peer);
                }
                updateCallOverlay(appState.activeCall, { statusText: 'تم قبول الاتصال، جاري ربط الصوت.' });
            } else if (signal.signal_type === 'ice-candidate' && payload) {
                try {
                    if (!peer.remoteDescription || !peer.remoteDescription.type) {
                        peer.iceCandidateQueue.push(payload);
                    } else {
                        await peer.addIceCandidate(new RTCIceCandidate(payload));
                    }
                } catch (error) {
                    console.error('ICE candidate apply error:', error);
                }
            }
        }

        async function startAudioCall() {
            if (!appState.currentConversationId) {
                toastr.warning('اختر محادثة أولاً');
                return;
            }

            if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
                toastr.warning('الاتصال الصوتي غير مدعوم على هذا المتصفح');
                return;
            }

            showLoading();
            try {
                const response = await apiRequest(`/messages/conversations/${appState.currentConversationId}/call`, 'POST', {
                    call_type: 'audio'
                });
                if (!response.success) {
                    return;
                }

                const call = response.data.call;
                appState.activeCall = call;
                appState.callStartedLocalTime = Date.now();
                if (appState.currentConversation) {
                    appState.currentConversation.active_call = call;
                }
                updateCallOverlay(call, {
                    incoming: false,
                    name: appState.currentConversation?.kind === 'support'
                        ? 'الدعم والمساعدة'
                        : (appState.currentConversation?.counterpart?.name || appState.currentConversation?.title || 'مستخدم المنصة'),
                    phase: 'dialing',
                    statusText: 'يتصل الآن... يتم تجهيز المكالمة الصوتية.'
                });
                appState.callLastSignalId = 0;
                await ensurePeerConnection(call.id);
                const peer = appState.peerConnection;
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                await apiRequest(`/messages/calls/${call.id}/signal`, 'POST', {
                    signal_type: 'offer',
                    payload: peer.localDescription.toJSON ? peer.localDescription.toJSON() : peer.localDescription
                });
                updateCallOverlay(call, {
                    incoming: false,
                    name: appState.currentConversation?.kind === 'support'
                        ? 'الدعم والمساعدة'
                        : (appState.currentConversation?.counterpart?.name || appState.currentConversation?.title || 'مستخدم المنصة'),
                    statusText: 'يرن الآن عند الطرف الآخر. بانتظار الرد.',
                    phase: 'ringing'
                });
                startCallPolling(call.id);
                updateCallControls();
            } catch (error) {
                console.error('Start audio call error:', error);
                toastr.error(getCallPermissionMessage(error, error.message || 'تعذر بدء الاتصال'));
                await cleanupCallResources();
            } finally {
                hideLoading();
            }
        }

        async function acceptIncomingCall() {
            if (!appState.activeCall?.id) {
                toastr.warning('لا يوجد اتصال وارد حالياً');
                return;
            }

            showLoading();
            try {
                if (Number(appState.currentConversationId) !== Number(appState.activeCall.conversation_id)) {
                    await openConversation(appState.activeCall.conversation_id, { silent: true });
                }
                await apiRequest(`/messages/calls/${appState.activeCall.id}/action`, 'POST', { action: 'accept' });
                appState.activeCall.status = 'active';
                if (appState.currentConversation) {
                    appState.currentConversation.active_call = appState.activeCall;
                }
                appState.callLastSignalId = 0;
                await ensurePeerConnection(appState.activeCall.id);
                updateCallOverlay(appState.activeCall, {
                    phase: 'connecting',
                    statusText: 'تم قبول الاتصال. جارٍ الآن ربط الصوت.'
                });
                startCallPolling(appState.activeCall.id);
                updateCallControls();
            } catch (error) {
                console.error('Accept call error:', error);
                toastr.error(getCallPermissionMessage(error, error.message || 'تعذر قبول الاتصال'));
            } finally {
                hideLoading();
            }
        }

        async function endCurrentCall(action = 'end') {
            if (!appState.activeCall?.id) {
                return;
            }

            try {
                const response = await apiRequest(`/messages/calls/${appState.activeCall.id}/action`, 'POST', { action });
                const call = response.data?.call || appState.activeCall;
                if (appState.currentConversation) {
                    appState.currentConversation.active_call = null;
                }
                updateCallOverlay(call, {
                    statusText: action === 'reject' ? 'تم رفض الاتصال.' : 'تم إنهاء الاتصال.'
                });
                $('#closeCallOverlayBtn').prop('hidden', false);
            } catch (error) {
                console.error('End call error:', error);
                toastr.error(error.message || 'تعذر إنهاء الاتصال');
            } finally {
                await cleanupCallResources();
                updateCallControls();
            }
        }

        async function uploadMessageAttachment(file) {
            const formData = new FormData();
            const fileName = file?.name || 'voice-message.webm';
            formData.append('file', file, fileName);

            try {
                const response = await apiFormRequest('/messages/upload', 'POST', formData);
                if (!response.success) {
                    const uploadError = new Error(response.error || 'تعذر رفع الملف');
                    uploadError.status = response.status || 400;
                    throw uploadError;
                }
                return response.data;
            } catch (error) {
                if (Number(error?.status) === 429) {
                    setMessageAttachmentStatus('تم إبطاء الرفع مؤقتًا بسبب كثرة الطلبات، انتظر قليلًا ثم حاول مجددًا.');
                }
                throw error;
            }
        }

        async function deleteMessageForEveryone(messageId) {
            if (!messageId || !appState.currentConversationId) {
                return;
            }

            showLoading();
            try {
                const response = await apiRequest(`/messages/messages/${messageId}`, 'DELETE');
                if (response.success) {
                    toastr.success(response.message || 'تم حذف الرسالة لدى الجميع');
                    await openConversation(appState.currentConversationId, { silent: true });
                    await loadConversations(appState.currentConversationId, {
                        silent: true,
                        skipConversationOpen: true
                    });
                }
            } catch (error) {
                console.error('Delete message error:', error);
                toastr.error(error.message || 'تعذر حذف الرسالة');
            } finally {
                hideLoading();
            }
        }

        async function deleteSpecialWalletProfile(profileId) {
            showLoading();
            try {
                const response = await apiRequest(`/admin/wallet-profiles/${profileId}`, 'DELETE');
                if (response.success) {
                    toastr.success('تم حذف المحفظة الخاصة بنجاح');
                    resetSpecialWalletProfileForm();
                    loadSpecialWalletProfiles();
                }
            } catch (error) {
                console.error('Delete special wallet profile error:', error);
                toastr.error('حدث خطأ أثناء حذف المحفظة الخاصة');
            } finally {
                hideLoading();
            }
        }

        async function loadAccountProfile() {
            try {
                const response = await apiRequest('/auth/profile');
                if (response.success) {
                    appState.userProfile = response.data;
                    appState.currentUser = response.data.profile;
                    appState.userWallets = response.data.wallets;
                    appState.isAdmin = response.data.profile.role === 'admin';
                    updateUI();
                    renderAccountProfile(response.data);
                    if (typeof loadAccountDevices === 'function') {
                        loadAccountDevices();
                    }
                }
            } catch (error) {
                console.error('Load account profile error:', error);
            }
        }

        function renderAccountProfile(data = appState.userProfile) {
            if (!data || !data.profile || !$('#account').length) {
                return;
            }

            const profile = data.profile;
            const stats = data.stats || {};
            const support = data.support || {};
            const referral = data.referral || {};
            const companyStats = data.company_stats || {};
            const googleLinked = Boolean(profile.google_linked || profile.google_sub);
            const kycStatus = String(profile.kyc_status || 'not_submitted');
            const accountType = String(profile.account_type || 'individual').toLowerCase();
            const isCompanyAccount = accountType === 'company';
            const companyProfile = profile.company_profile || {};
            const kycStatusMap = {
                not_submitted: { label: 'غير موثق', badge: 'status-rejected' },
                pending: { label: 'قيد المراجعة', badge: 'status-pending' },
                verified: { label: 'موثق', badge: 'status-completed' },
                rejected: { label: 'مرفوض ويحتاج إعادة', badge: 'status-rejected' }
            };
            const companyStatusMap = {
                draft: { label: 'قيد الإعداد', badge: 'status-pending' },
                pending: { label: 'قيد المراجعة', badge: 'status-pending' },
                verified: { label: 'شركة موثقة', badge: 'status-completed' },
                rejected: { label: 'مرفوض ويحتاج تعديل', badge: 'status-rejected' }
            };
            const kycDocumentMap = {
                national_id: 'هوية وطنية',
                passport: 'جواز سفر',
                residence: 'إقامة',
                ownership: 'إثبات ملكية'
            };
            const kycMeta = kycStatusMap[kycStatus] || kycStatusMap.not_submitted;
            const companyMeta = companyStatusMap[String(companyProfile.verification_status || 'draft')] || companyStatusMap.draft;
            const authProviderRaw = String(profile.auth_provider || (googleLinked ? 'google' : 'password'));
            const authProviderLabel = authProviderRaw.includes('google')
                ? (authProviderRaw.includes('password') ? 'بالبريد + Google' : 'عبر Google')
                : 'بالبريد وكلمة المرور';

            $('#accountProfileLead').text(`مرحباً ${profile.name || ''}، هذا ملفك الشخصي ورقم حسابك العام الذي يمكنك مشاركته للتحويل الداخلي.`);
            $('#accountRoleBadge')
                .text(profile.role === 'admin' ? 'مدير' : (isCompanyAccount ? 'شركة' : 'مستخدم'))
                .removeClass('status-completed status-pending')
                .addClass(profile.role === 'admin' ? 'status-pending' : 'status-completed');
            $('#accountPublicId').text(profile.public_user_id || '-');
            $('#accountEmail').text(profile.email || '-');
            $('#accountCreatedAt').text(profile.created_at || '-');
            $('#accountEmailStatus').text(profile.email_verified ? 'موثق' : 'غير موثق');
            $('#accountNameInput').val(profile.name || '');
            $('#accountPhoneInput').val(profile.phone || '');
            $('#accountCountryInput').val(profile.preferred_country_code || appState.selectedCountryCode || '');
            $('#accountReferralCode').text(profile.referral_code || '-');
            $('#accountReferralRate').text(`${Number(referral.bonus_rate || 0).toFixed(2)}%`);
            $('#accountReferralCount').text(referral.referred_users_count || 0);
            $('#accountReferralEarnings').text(`${Number(referral.total_earnings || 0).toFixed(8)} USDT`);
            $('#accountSummaryInvestments').text(Number(stats.total_investments || 0).toLocaleString('ar-SA'));
            $('#accountSummaryCapital').text(`${Number(stats.total_invested || 0).toFixed(2)} USDT`);
            $('#accountSummaryReturns').text(`${Number(stats.total_returns || 0).toFixed(8)} USDT`);
            $('#accountSummaryReferrals').text(Number(referral.referred_users_count || 0).toLocaleString('ar-SA'));

            $('#accountReferralEarnings').text(`${Number(referral.total_earnings || 0).toFixed(8)} USDT`);
            $('#accountSummaryInvestments').text(Number(stats.total_investments || 0).toLocaleString('ar-SA'));
            $('#accountSummaryCapital').text(`${Number(stats.total_invested || 0).toFixed(2)} USDT`);
            $('#accountSummaryReturns').text(`${Number(stats.total_returns || 0).toFixed(8)} USDT`);
            $('#accountSummaryReferrals').text(Number(referral.referred_users_count || 0).toLocaleString('ar-SA'));

            // ==========================================
            // تحديث لوحة التحكم الشخصية المباشرة (#dashboard)
            // ==========================================
            const activeInvestments = data.active_investments || [];
            let dailyEarnings = 0;
            let monthlyEarnings = 0;
            let highestRate = 0;
            let highestRateProjectName = 'لا توجد مشاريع نشطة';
            const totalInvestedSum = Number(stats.total_invested || 0);

            $('#dashboardUserWelcome').text(`أهلاً بك، ${profile.name || 'المستثمر'}`);
            $('#dashboardUserLead').html(`مركز متابعة محفظتك العقارية الرقمية، العوائد اليومية والشهرية، وتوزيع استثماراتك المباشر. (رقم الحساب: <strong>#${profile.public_user_id || '-'}</strong>)`);
            $('#dashboardPublicId').text(profile.public_user_id || '-');
            $('#dashboardKycBadge')
                .text(kycMeta.label)
                .removeClass('status-completed status-pending status-rejected')
                .addClass(kycMeta.badge);

            const usdtWallet = (data.wallets || []).find(w => String(w.code || '').toUpperCase() === 'USDT');
            if (usdtWallet) {
                $('#dashboardAvailableBalance').text(`${Number(usdtWallet.balance || 0).toFixed(2)} USDT`);
            }

            const dashTableBody = $('#dashboardTableBody');
            const dashBreakdownList = $('#dashboardBreakdownList');

            if (activeInvestments.length === 0) {
                if (dashTableBody.length) {
                    dashTableBody.html(`
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 30px; color: var(--gray);">
                                <div style="font-size: 1.1rem; margin-bottom: 6px;"><i class="fas fa-info-circle" style="color: var(--primary);"></i> ليس لديك استثمارات نشطة حالياً</div>
                                <small>تصفح المشاريع المتاحة وابدأ استثمارك الأول للحصول على أرباح يومية وشهرية مخصصة.</small>
                            </td>
                        </tr>
                    `);
                }
                if (dashBreakdownList.length) {
                    dashBreakdownList.html(`
                        <div style="text-align: center; color: var(--gray); padding: 15px; background: rgba(248,250,252,0.6); border-radius: 12px;">
                            <small>لا توجد بيانات توزيع حالية لعدم وجود استثمارات نشطة.</small>
                        </div>
                    `);
                }
                $('#dashboardDailyEarnings').text('0.00 USDT');
                $('#dashboardMonthlyEarnings').text('0.00 USDT');
                $('#dashboardTotalInvested').text('0.00 USDT');
                $('#dashboardTotalReturns').text('0.00 USDT');
                $('#dashboardHighestRate').text('0.0%');
                $('#dashboardHighestProjectName').text('لا توجد مشاريع نشطة');
                $('#dashboardActiveCount').text('0');
            } else {
                // البحث عن أعلى عائد واحتساب الأرباح التراكمية
                activeInvestments.forEach(item => {
                    const rate = Number(item.return_rate || 0);
                    if (rate > highestRate) {
                        highestRate = rate;
                        highestRateProjectName = item.project_name;
                    }
                });

                let tableHtml = '';
                let breakdownHtml = '';

                activeInvestments.forEach(item => {
                    const amount = Number(item.amount || 0);
                    const rate = Number(item.return_rate || 0);
                    const returns = Number(item.returns || 0);
                    
                    const itemMonthly = amount * (rate / 100);
                    const itemDaily = itemMonthly / 30;
                    const sharePercentage = totalInvestedSum > 0 ? ((amount / totalInvestedSum) * 100).toFixed(1) : 0;

                    monthlyEarnings += itemMonthly;
                    dailyEarnings += itemDaily;

                    const isHighest = rate === highestRate && highestRate > 0;
                    const badgeHtml = isHighest 
                        ? `<span class="status-badge status-completed" style="font-size: 0.72rem; padding: 2px 6px; margin-inline-start: 6px; background: rgba(16, 185, 129, 0.1); color: #047857;">الأعلى عائداً</span>` 
                        : '';

                    tableHtml += `
                        <tr style="border-bottom: 1px solid rgba(217, 227, 236, 0.5); vertical-align: middle;">
                            <td style="padding: 14px 10px;">
                                <strong>${sanitizeHtml(item.project_name)}</strong>
                                ${badgeHtml}
                            </td>
                            <td style="padding: 14px 10px; font-weight: 700;">${amount.toFixed(2)} USDT</td>
                            <td style="padding: 14px 10px; color: var(--primary); font-weight: 800;">${rate.toFixed(1)}% / شهرياً</td>
                            <td style="padding: 14px 10px; color: #059669; font-weight: 700;">+${returns.toFixed(4)} USDT</td>
                            <td style="padding: 14px 10px; font-weight: 800; color: var(--primary-strong);">${itemMonthly.toFixed(2)} USDT</td>
                            <td style="padding: 14px 10px; text-align: center;">
                                <span class="status-badge status-completed" style="font-size: 0.75rem;">نشط ومكتسب</span>
                            </td>
                        </tr>
                    `;

                    breakdownHtml += `
                        <div style="background: rgba(248, 250, 252, 0.9); padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(226, 232, 240, 0.8);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.88rem;">
                                <strong>${sanitizeHtml(item.project_name)}</strong>
                                <span style="font-weight: 700; color: var(--primary);">${amount.toFixed(2)} USDT (${sharePercentage}%)</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${sharePercentage}%; height: 100%; background: linear-gradient(90deg, #10b981, #047857); border-radius: 4px; transition: width 0.4s ease;"></div>
                            </div>
                        </div>
                    `;
                });

                if (dashTableBody.length) dashTableBody.html(tableHtml);
                if (dashBreakdownList.length) dashBreakdownList.html(breakdownHtml);

                $('#dashboardDailyEarnings').text(`${dailyEarnings.toFixed(2)} USDT`);
                $('#dashboardMonthlyEarnings').text(`${monthlyEarnings.toFixed(2)} USDT`);
                $('#dashboardTotalInvested').text(`${totalInvestedSum.toFixed(2)} USDT`);
                $('#dashboardTotalReturns').text(`${Number(stats.total_returns || 0).toFixed(4)} USDT`);
                $('#dashboardHighestRate').text(`${highestRate.toFixed(1)}%`);
                $('#dashboardHighestProjectName').text(highestRateProjectName);
                $('#dashboardActiveCount').text(Number(stats.total_investments || 0).toLocaleString('ar-SA'));
            }
            $('#accountSupportEmail').text(support.email || 'support@invest-platform.com');
            $('#accountSupportPhone').text(support.phone || '+966500000000');
            $('#contactSupportEmailBtn').attr('href', `mailto:${support.email || 'support@invest-platform.com'}`);
            $('#contactSupportPhoneBtn').attr('href', `tel:${support.phone || '+966500000000'}`);
            $('#accountSupportLead').text(
                `عدد استثماراتك الحالية ${stats.total_investments || 0}، وإجمالي أرباحك الحالية ${Number(stats.total_returns || 0).toFixed(8)}.`
            );
            $('#accountKycStatusBadge')
                .text(kycMeta.label)
                .removeClass('status-completed status-pending status-rejected')
                .addClass(kycMeta.badge);
            $('#accountKycStatusText').text(kycMeta.label);
            $('#accountKycDocumentType').text(kycDocumentMap[profile.kyc_document_type] || '-');
            $('#accountKycSubmittedAt').text(profile.kyc_submitted_at || '-');
            $('#accountKycReviewedAt').text(profile.kyc_reviewed_at || profile.kyc_verified_at || '-');
            $('#accountKycFullName').val(profile.kyc_full_name || profile.name || '');
            $('#accountKycDocumentTypeInput').val(profile.kyc_document_type || '');
            $('#accountKycLead').text(
                kycStatus === 'verified'
                    ? 'حسابك موثق الآن، ويمكنك نشر العقارات والانتقال للخطوات الحساسة دون رفع KYC مرة أخرى.'
                    : kycStatus === 'pending'
                        ? 'طلب التوثيق قيد المراجعة الآن. ما إن يتم اعتماده ستتمكن من نشر العقارات مباشرة.'
                        : kycStatus === 'rejected'
                            ? 'تمت إعادة طلب التوثيق. راجع الملاحظة ثم أعد إرسال المستندات الصحيحة.'
                            : 'ارفع مستندات الهوية مرة واحدة، وبعد اعتماد الحساب يمكنك نشر العقارات مباشرة دون تكرار KYC لكل إعلان.'
            );
            $('#accountKycRejectionNoteWrap').toggle(kycStatus === 'rejected' && Boolean(profile.kyc_rejection_note));
            $('#accountKycRejectionNote').text(profile.kyc_rejection_note || '-');
            $('#submitAccountKycBtn').prop('disabled', kycStatus === 'pending');
            if (typeof syncAccountKycPreview === 'function') {
                syncAccountKycPreview();
            }

            // Update 2FA UI elements
            const is2faEnabled = Boolean(profile.two_factor_enabled);
            $('#accountTwoFactorStatusBadge')
                .text(is2faEnabled ? 'مفعلة' : 'غير مفعلة')
                .removeClass('status-completed status-pending')
                .addClass(is2faEnabled ? 'status-completed' : 'status-pending');

            if (is2faEnabled) {
                $('#twoFactorEnabledSection').show();
                $('#twoFactorSetupSection').hide();
                $('#twoFactorInitialSection').hide();
                $('#twoFactorDisableCode').val('');
                $('#twoFactorBackupCodesContainer').hide();
            } else {
                $('#twoFactorEnabledSection').hide();
                $('#twoFactorSetupSection').hide();
                $('#twoFactorInitialSection').show();
            }
            if (profile.preferred_country_name) {
                $('#accountProfileLead').text(`مرحباً ${profile.name || ''}، سوقك المفضل الحالي هو ${profile.preferred_country_name} ويمكنك تغييره من إعدادات الحساب في أي وقت.`);
            }
            $('#companyProfileCard').toggle(isCompanyAccount);
            if (isCompanyAccount) {
                const companyVerificationStatus = String(companyProfile.verification_status || 'draft').toLowerCase();
                $('#companyVerificationBadge')
                    .text(companyMeta.label)
                    .removeClass('status-completed status-pending status-rejected')
                    .addClass(companyMeta.badge);
                $('#companyVerificationStatus').text(companyMeta.label);
                $('#companyDisplayName').text(companyProfile.company_name || '-');
                $('#companyDocumentsCount').text(Number(companyStats.document_count || (companyProfile.document_urls || []).length || 0).toLocaleString('ar-SA'));
                $('#companyProjectsCount').text(Number(companyStats.total_projects || 0).toLocaleString('ar-SA'));
                $('#companyProfileLead').text(
                    companyMeta.label === 'شركة موثقة'
                        ? 'هذا الحساب مرتبط بشركة موثقة ويمكنه استخدام بيانات الشركة مباشرة داخل المشاريع والعقارات.'
                        : companyMeta.label === 'قيد المراجعة'
                            ? 'ملف الشركة الآن لدى الأدمن للمراجعة. يمكنك متابعة الحالة من هنا حتى يصلك الاعتماد.'
                            : 'حدّث بيانات الشركة هنا ثم أرسل الملف للمراجعة ليصبح الحساب جاهزًا لنشر المشاريع.'
                );
                $('#companyVerificationNoteWrap').toggle(Boolean(companyProfile.verification_note));
                $('#companyVerificationNote').text(companyProfile.verification_note || '-');
                $('#accountCompanyNameInput').val(companyProfile.company_name || '');
                $('#accountRepresentativeNameInput').val(companyProfile.representative_name || '');
                $('#accountTradeNameInput').val(companyProfile.trade_name || '');
                $('#accountRegistrationNumberInput').val(companyProfile.registration_number || '');
                $('#accountRepresentativeTitleInput').val(companyProfile.representative_title || '');
                $('#accountCompanyPhoneInput').val(companyProfile.company_phone || profile.phone || '');
                $('#accountCompanyEmailInput').val(companyProfile.company_email || profile.email || '');
                $('#accountCompanyCountryInput').val(companyProfile.country_code || profile.preferred_country_code || '');
                $('#accountCompanyCityInput').val(companyProfile.city || '');
                $('#accountCompanyWebsiteInput').val(companyProfile.website_url || '');
                $('#accountCompanyAddressInput').val(companyProfile.address || '');
                $('#accountCompanyDescriptionInput').val(companyProfile.description || '');
                $('#accountCompanyLogoInput').val(companyProfile.logo_url || '');
                $('#companyLogoPreviewWrap').toggle(Boolean(companyProfile.logo_url));
                $('#companyLogoPreview').attr('src', companyProfile.logo_url || '');
                $('#submitCompanyVerificationBtn').prop('disabled', companyVerificationStatus === 'pending');
                if (typeof syncCompanyDocumentsPreview === 'function') {
                    syncCompanyDocumentsPreview();
                }

                if (typeof queueSiteNotification === 'function') {
                    if (companyVerificationStatus === 'rejected') {
                        queueSiteNotification({
                            key: `company-rejected-${profile.id}`,
                            title: 'ملف الشركة يحتاج تعديل',
                            body: companyProfile.verification_note || 'راجع ملاحظات الأدمن ثم أعد إرسال ملف الشركة.',
                            level: 'warning',
                            section: 'account',
                            ttlMs: 1000 * 60 * 60 * 24
                        });
                    } else if (companyVerificationStatus === 'verified') {
                        queueSiteNotification({
                            key: `company-verified-${profile.id}`,
                            title: 'تم اعتماد الشركة',
                            body: 'يمكنك الآن نشر مشاريع استثمارية باسم الشركة من داخل المنصة.',
                            level: 'success',
                            section: 'investments',
                            ttlMs: 1000 * 60 * 60 * 24
                        });
                    }
                }
            } else {
                $('#companyVerificationNoteWrap').hide();
                $('#companyLogoPreviewWrap').hide();
            }
            $('#accountGoogleStatus').text(googleLinked ? 'مربوط وجاهز' : 'غير مربوط');
            $('#accountAuthProvider').text(authProviderLabel);
            $('#accountGoogleLead').text(
                googleLinked
                    ? 'حساب Google مربوط بالفعل، ويمكنك استخدامه للدخول السريع لاحقًا.'
                    : 'اربط Google بنفس بريدك الحالي لتسهيل الدخول الآمن لاحقًا.'
            );
            $('#googleAuthButtonLink').toggle(!googleLinked);
            $('#googleAuthUnavailableLink').prop('hidden', googleLinked || Boolean(window.APP_CONFIG?.googleClientId));
            if (typeof initializeGoogleAuthButtons === 'function') {
                initializeGoogleAuthButtons();
            }
            renderAccountHeroPanel(data);
        }

        if (appState.currentUser) {
            startMessagesHeartbeat();
            if (appState.currentSection === 'messages') {
                startMessagesRealtime();
            }
        }

        // Expose call actions globally to avoid script scoping and ordering issues
        window.hideCallOverlay = hideCallOverlay;
        window.cleanupCallResources = cleanupCallResources;
        window.endCurrentCall = endCurrentCall;
        window.acceptIncomingCall = acceptIncomingCall;
        window.toggleCallMicrophone = toggleCallMicrophone;
        window.toggleCallSpeaker = toggleCallSpeaker;
        window.deleteMessageForEveryone = deleteMessageForEveryone;
        window.openConversation = openConversation;
        window.loadConversations = loadConversations;
        window.resetMessageAttachmentState = resetMessageAttachmentState;
        window.setMessageAttachmentStatus = setMessageAttachmentStatus;
        window.startConversation = startConversation;
        window.startMessagesRealtime = startMessagesRealtime;
        window.stopMessagesRealtime = stopMessagesRealtime;
