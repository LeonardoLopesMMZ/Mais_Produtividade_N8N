"""Gera workflow.json a partir de code/*.js. Uso: python3 build_workflow.py"""
import json, uuid, pathlib

root = pathlib.Path(__file__).parent
code = lambda f: (root / "code" / f).read_text()
uid = lambda: str(uuid.uuid4())
SHEET = {"documentId": {"__rl": True, "mode": "id", "value": "1ly23ejnGo2LjQda-MY5CDbfkLH0RWyfEUM1OMDDjby8"},
         "sheetName": {"__rl": True, "mode": "id", "value": "0"}}
nodes, conns = [], {}

def add(name, type_, params, pos, ver=1, **extra):
    nodes.append({"parameters": params, "id": uid(), "name": name, "type": type_,
                  "typeVersion": ver, "position": pos, **extra})

def link(a, b, out=0):
    conns.setdefault(a, {"main": []})["main"]
    m = conns[a]["main"]
    while len(m) <= out: m.append([])
    m[out].append({"node": b, "type": "main", "index": 0})

def tg(name, text, chat, pos):
    add(name, "n8n-nodes-base.telegram",
        {"chatId": chat, "text": text, "additionalFields": {"appendAttribution": False}}, pos, 1.2)

def sheets_read(name, pos):
    add(name, "n8n-nodes-base.googleSheets", {"resource": "sheet", "operation": "read", **SHEET},
        pos, 4.5, alwaysOutputData=True)

def code_node(name, f, pos):
    add(name, "n8n-nodes-base.code", {"jsCode": code(f)}, pos, 2)

def cond(left, right, typ="string", op="equals"):
    c = {"id": uid(), "leftValue": left, "operator": {"type": typ, "operation": op}}
    if typ == "string": c["rightValue"] = right
    else: c["operator"]["singleValue"] = True
    return {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [c], "combinator": "and"}

CHAT = "={{ $('Parse').first().json.chatId }}"

# --- Captura (Telegram) ---
add("Telegram Trigger", "n8n-nodes-base.telegramTrigger", {"updates": ["message"], "additionalFields": {}},
    [0, 300], 1.1, webhookId=uid())
code_node("Parse", "parse.js", [220, 300])
add("Roteador", "n8n-nodes-base.switch", {"rules": {"values": [
    {"outputKey": k, "renameOutput": True, "conditions": cond("={{ $json.cmd }}", k)} for k in ("add", "feito", "lista")]},
    "options": {"fallbackOutput": "extra"}}, [440, 300], 3.2)
link("Telegram Trigger", "Parse"); link("Parse", "Roteador")

# add
sheets_read("Ler tarefas (add)", [680, 0])
code_node("Checar duplicata", "dedup.js", [900, 0])
add("Duplicada?", "n8n-nodes-base.if", {"conditions": cond("={{ $json.duplicada }}", None, "boolean", "true")},
    [1120, 0], 2.2)
tg("Avisar duplicada", "={{ $json.msgDup }}", CHAT, [1340, -100])
add("Gravar tarefa", "n8n-nodes-base.googleSheets", {"resource": "sheet", "operation": "append", **SHEET,
    "columns": {"mappingMode": "defineBelow", "matchingColumns": [], "schema": [], "value": {
        k: "={{ $json.%s }}" % k for k in ("id", "tarefa", "quem", "prazo", "prioridade", "criada_em")} | {"status": "pendente"}},
    "options": {}}, [1340, 100], 4.5)
tg("Confirmar anotada", "={{ $('Checar duplicata').first().json.msgOk }}", CHAT, [1560, 100])
for a, b, o in [("Roteador", "Ler tarefas (add)", 0), ("Ler tarefas (add)", "Checar duplicata", 0),
                ("Checar duplicata", "Duplicada?", 0), ("Duplicada?", "Avisar duplicada", 0),
                ("Duplicada?", "Gravar tarefa", 1), ("Gravar tarefa", "Confirmar anotada", 0)]:
    link(a, b, o)

# feito
sheets_read("Ler tarefas (feito)", [680, 300])
code_node("Achar tarefa", "achar.js", [900, 300])
add("Achou?", "n8n-nodes-base.if", {"conditions": cond("={{ $json.achou }}", None, "boolean", "true")}, [1120, 300], 2.2)
add("Marcar feita", "n8n-nodes-base.googleSheets", {"resource": "sheet", "operation": "update", **SHEET,
    "columns": {"mappingMode": "defineBelow", "matchingColumns": ["id"], "schema": [], "value": {
        "id": "={{ $json.id }}", "status": "feito", "concluida_em": "={{ $json.concluida_em }}"}},
    "options": {}}, [1340, 260], 4.5)
tg("Confirmar feita", "={{ $('Achar tarefa').first().json.msgOk }}", CHAT, [1560, 260])
tg("Avisar não achou", "={{ $json.msgNao }}", CHAT, [1340, 420])
for a, b, o in [("Roteador", "Ler tarefas (feito)", 1), ("Ler tarefas (feito)", "Achar tarefa", 0),
                ("Achar tarefa", "Achou?", 0), ("Achou?", "Marcar feita", 0), ("Achou?", "Avisar não achou", 1),
                ("Marcar feita", "Confirmar feita", 0)]:
    link(a, b, o)

# resumo (/lista e agenda)
sheets_read("Ler tarefas (resumo)", [900, 620])
code_node("Priorizar", "priorizar.js", [1120, 620])
tg("Enviar resumo", "={{ $json.text }}", "={{ $json.chatId }}", [1340, 620])
link("Roteador", "Ler tarefas (resumo)", 2); link("Ler tarefas (resumo)", "Priorizar"); link("Priorizar", "Enviar resumo")
add("Agenda 9h e 15h (seg-sex)", "n8n-nodes-base.scheduleTrigger",
    {"rule": {"interval": [{"field": "cronExpression", "expression": "0 9,15 * * 1-5"}]}}, [0, 760], 1.2)
add("Config", "n8n-nodes-base.set", {"assignments": {"assignments": [
    {"id": uid(), "name": "chat_id", "value": "COLE_AQUI_SEU_CHAT_ID", "type": "string"}]}, "options": {}},
    [440, 760], 3.4)
link("Agenda 9h e 15h (seg-sex)", "Config"); link("Config", "Ler tarefas (resumo)")

# ajuda
tg("Enviar ajuda", "🧠 Anti-procrastinação\n\n/add tarefa | quem pediu | 25/11 | alta\n(só a tarefa é obrigatória; prazo padrão = amanhã)\n/feito id\n/lista\n\nTexto solto também vira tarefa.", CHAT, [680, 880])
link("Roteador", "Enviar ajuda", 3)

wf = {"name": "Anti-Procrastinação (Telegram + Sheets)", "nodes": nodes, "connections": conns,
      "settings": {"executionOrder": "v1", "timezone": "America/Sao_Paulo"}, "pinData": {}}
(root / "workflow.json").write_text(json.dumps(wf, ensure_ascii=False, indent=2))
print(len(nodes), "nós")
