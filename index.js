const https = require('https');
const querystring = require('querystring');

function escapeMarkdown(text) {
    return text.replace(/[-_.*[\]()`~]/g, '\\$&');
}

module.exports.handler = async function (event, context) {
    try {
        const gitlabEvent = JSON.parse(event.body);
        let message = '';
        console.log(event.body)

        switch (gitlabEvent.object_kind) {
            case 'merge_request':
                if (gitlabEvent.object_attributes.action === 'approved') {
                    message = formatMergeRequestApproved(gitlabEvent);
                } else if (gitlabEvent.object_attributes.action === 'open') {
                    message = formatMergeRequestCreated(gitlabEvent);
                } else if (gitlabEvent.object_attributes.action === 'close') {
                    message = formatMergeRequestClosed(gitlabEvent);
                } else if (gitlabEvent.object_attributes.action === 'merge') {
                    message = formatMergeRequestMerged(gitlabEvent);
                } else {
                    message = `[DEBUG] Неизвестный экшн по merge_request ${gitlabEvent.object_attributes.action}`
                }
                break;
            case 'pipeline':
                message = formatPipelineEvent(gitlabEvent);
                break;
            case 'note':
                if (gitlabEvent.object_attributes.noteable_type === 'MergeRequest') {
                    message = formatMergeRequestComment(gitlabEvent);
                }
                break;
            default:
                message = `[DEBUG] Необработанный тип события: ${gitlabEvent.object_kind}`;
        }

        const telegramMessage = message;
        await sendTelegramMessage(telegramMessage);

        return {
            statusCode: 200,
            body: 'Успешно обработано',
        };
    } catch (error) {
        console.error('Ошибка обработки события GitLab:', error);
        return {
            statusCode: 500,
            body: 'Произошла ошибка при обработке события GitLab',
        };
    }
};

function formatMergeRequestCreated(event) {
    const user = escapeMarkdown(event.user.name);
    const title = escapeMarkdown(event.object_attributes.title);
    const sourceBranch = escapeMarkdown(event.object_attributes.source_branch);
    const targetBranch = escapeMarkdown(event.object_attributes.target_branch);
    const mrLink = escapeMarkdown(event.object_attributes.url);
    return `🟢 Новый мердж [${title}](${mrLink}) от *${user}*
    Ветка источника: *${sourceBranch}*  
    Целевая ветка: *${targetBranch}*`;
}

function formatMergeRequestClosed(event) {
    const user = escapeMarkdown(event.user.name);
    const title = escapeMarkdown(event.object_attributes.title);
    const mrLink = escapeMarkdown(event.object_attributes.url); // Добавляем URL мердж реквеста
    return `Mердж [${title}](${mrLink}) закрыт пользователем *${user}*`;
}

function formatMergeRequestComment(event) {
    const user = escapeMarkdown(event.user.name);
    const mrTitle = escapeMarkdown(event.merge_request.title);
    const comment = escapeMarkdown(event.object_attributes.note);
    const mrLink = escapeMarkdown(event.merge_request.url);
    return `💬 Комментарий к мерджу [${mrTitle}](${mrLink}) от *${user}*:
    \`${comment}\``;
}

function formatMergeRequestApproved(event) {
    const user = escapeMarkdown(event.user.name);
    const title = escapeMarkdown(event.object_attributes.title);
    const sourceBranch = escapeMarkdown(event.object_attributes.source_branch);
    const targetBranch = escapeMarkdown(event.object_attributes.target_branch);
    const mrLink = escapeMarkdown(event.object_attributes.url); // Добавляем URL мердж реквеста
    return `🟡 **Мердж [${title}](${mrLink}) апрувнут *${user}*:
    **Ветка источника:** ${sourceBranch}
    **Целевая ветка:** ${targetBranch}`;
}

function formatMergeRequestMerged(event) {
    const user = escapeMarkdown(event.user.name);
    const title = escapeMarkdown(event.object_attributes.title);
    const sourceBranch = escapeMarkdown(event.object_attributes.source_branch);
    const targetBranch = escapeMarkdown(event.object_attributes.target_branch);
    const mergeUser = escapeMarkdown(event.object_attributes.last_commit.author.name);
    const mrLink = escapeMarkdown(event.object_attributes.url); // Добавляем URL мердж реквеста
    return `🟣 **Мердж [${title}](${mrLink}) слит пользователем ${user}**:
    **Ветка источника:** ${sourceBranch}
    **Целевая ветка:** ${targetBranch}`;
}

function formatPipelineEvent(event) {
    const pipelineStatus = escapeMarkdown(event.object_attributes.status);
    const pipelineName = escapeMarkdown(event.object_attributes?.name || event.commit?.title || '');
    return `🔧 Пайплайн *${pipelineName}*, статус: *${pipelineStatus}*`;
}

async function sendTelegramMessage(message) {
    const queryParams = querystring.stringify({ chat_id: '{YOUR_CHAT_ID_HERE}', text: message, parse_mode: 'MarkdownV2' });
    // parse_mode: 'MarkdownV2'
    await https.get(`https://api.telegram.org/bot{YOUR_BOT_TOKEN_HERE}/sendMessage?${queryParams}`);
}