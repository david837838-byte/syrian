import json
import codecs

log_path = r'C:\Users\moham\.gemini\antigravity-ide\brain\9b7d5bc7-f0f9-419f-9d7e-4a446d74d969\.system_generated\logs\transcript.jsonl'
output = None

with codecs.open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'TOOL_RESPONSE':
                content = data.get('content', '')
                if isinstance(content, dict):
                    content = content.get('output', '')
                elif isinstance(content, list) and len(content) > 0 and isinstance(content[0], dict):
                    content = content[0].get('text', '')
                
                if isinstance(content, str) and 'Showing lines 378 to 1177' in content:
                    output = content
                    # Don't break, get the latest one just in case
        except Exception:
            pass

if output:
    lines = output.split('\n')
    good_lines = []
    collecting = False
    for l in lines:
        if l.startswith('378:'):
            collecting = True
        if l.startswith('The above content does NOT show') or l.startswith('The above content shows'):
            collecting = False
            
        if collecting:
            if ': ' in l and l.split(':', 1)[0].isdigit():
                good_lines.append(l.split(': ', 1)[1])
            elif l.endswith(':'): # Empty lines match like '1177:'
                good_lines.append('')
            else:
                good_lines.append(l)

    if len(good_lines) > 700:
        with codecs.open('routes/transactions.py', 'r', encoding='utf-8') as f:
            file_lines = f.readlines()
        
        final_lines = [line.rstrip('\n') for line in file_lines[:377]]
        final_content = '\n'.join(final_lines) + '\n' + '\n'.join(good_lines) + '\n'
        
        with codecs.open('routes/transactions.py', 'w', encoding='utf-8') as f:
            f.write(final_content)
        print("RESTORED SUCCESS! Lines restored:", len(good_lines))
    else:
        print("FOUND BUT NOT ENOUGH LINES:", len(good_lines))
else:
    print("NOT FOUND IN LOGS")
