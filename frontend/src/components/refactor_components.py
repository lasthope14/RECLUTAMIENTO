import re

def refactor_content(content):
    # Backdrop overlay
    content = content.replace("bg-slate-950/80 backdrop-blur-sm", "bg-slate-900/30 backdrop-blur-sm")
    
    # Outer layout container (modal / drawer canvas)
    content = content.replace("bg-[#0f172a] w-full", "bg-white w-full")
    content = content.replace("border border-[#1e293b]", "border border-slate-200")
    
    # Loading / Fallback bg
    content = content.replace("bg-[#0a0f1d]", "bg-slate-50")
    content = content.replace("border border-red-950/50", "border border-slate-200 shadow-sm")
    
    # Header bg and border
    content = content.replace("bg-[#0a0f1d] border-b border-[#1e293b]", "bg-slate-50 border-b border-slate-200")
    
    # Score circle backgrounds
    content = content.replace("bg-[#0f172a] border border-[#1e293b] rounded-full", "bg-white border border-slate-200 rounded-full shadow-sm")
    content = content.replace("stroke=\"rgba(255,255,255,0.02)\"", "stroke=\"rgba(15, 23, 42, 0.05)\"")
    content = content.replace("font-black text-white", "font-black text-slate-850")
    
    # Initials avatar circle
    content = content.replace("bg-[#0f172a] border border-[#1e293b] rounded-full flex items-center justify-center text-white", "bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-700")
    
    # Recommendation tag desaturated
    content = content.replace(
        "bg-[#1e293b] text-brand-300 border border-[#1e293b]",
        "`bg-brand-50 text-brand-700 border border-brand-200`"
    )
    # Actually, we want to replace the whole dynamic block:
    content = content.replace(
        "className=\"inline-flex items-center px-2.5 py-0.5 rounded-md text-[9px] font-bold bg-[#1e293b] text-brand-300 border border-[#1e293b]\"",
        "className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[9px] font-bold border ${"
        "ev.recomendacion === 'altamente_recomendado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :"
        " ev.recomendacion === 'recomendado' ? 'bg-blue-50 text-blue-700 border-blue-200' :"
        " ev.recomendacion === 'con_reservas' ? 'bg-amber-50 text-amber-700 border-amber-200' :"
        " 'bg-red-50 text-red-700 border-red-200'}`}"
    )

    # Name and text colors in header
    content = content.replace("text-xl md:text-2xl font-bold text-white", "text-xl md:text-2xl font-bold text-slate-800")
    content = content.replace("text-slate-300", "text-slate-700")
    content = content.replace("text-slate-400", "text-slate-500")
    content = content.replace("text-slate-450", "text-slate-400")
    content = content.replace("text-white font-bold", "text-slate-800 font-bold")
    
    # Sidebar tabs inactive/active
    content = content.replace("border-brand-500 text-brand-300 font-extrabold", "border-brand-500 text-brand-600 font-extrabold bg-brand-50/50 rounded-t-xl")
    content = content.replace("border-transparent text-slate-400 hover:text-slate-200", "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50 rounded-t-xl")
    
    # Close button bg
    content = content.replace("bg-[#0f172a] hover:bg-[#1e293b] text-slate-400 hover:text-white transition-all border border-[#1e293b]", "bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all border border-slate-200 shadow-sm")
    
    # Main tab panel container bg
    content = content.replace("bg-[#0a0f1d]\"", "bg-white\"")
    content = content.replace("bg-[#0a0f1d] }", "bg-white }")
    content = content.replace("bg-[#0a0f1d]`", "bg-white`")
    
    # Tab 1: Analysis IA pendente / loading / error
    content = content.replace("bg-[#0f172a] rounded-2xl border border-[#1e293b]", "bg-white rounded-2xl border border-slate-200 shadow-sm")
    content = content.replace("bg-red-950/20 rounded-2xl border border-red-900/40", "bg-red-50 rounded-2xl border border-red-200")
    content = content.replace("text-red-400 font-bold", "text-red-700 font-bold")
    content = content.replace("text-slate-400 max-w-sm", "text-slate-500 max-w-sm")
    
    # Justification card
    content = content.replace("border-l-2 border-brand-500 bg-slate-50 p-5 rounded-r-2xl", "border-l-4 border-brand-500 bg-brand-50/40 p-5 rounded-r-2xl")
    
    # Strengths / Breaches headings & lists
    content = content.replace("text-sm font-bold text-white mb-4", "text-sm font-bold text-slate-800 mb-4")
    content = content.replace("border-b border-[#1e293b] pb-3", "border-b border-slate-200 pb-3")
    content = content.replace("bg-emerald-950/40 text-emerald-400 border border-emerald-900/30", "bg-emerald-50 text-emerald-700 border border-emerald-200")
    content = content.replace("bg-red-950/40 text-red-400 border border-red-900/30", "bg-red-50 text-red-700 border border-red-200")
    
    # Compatibility ring
    content = content.replace("text-5xl font-black text-white", "text-5xl font-black text-slate-800")
    content = content.replace("ScoreBar label", "ScoreBar label")
    
    # ScoreBar
    content = content.replace("font-semibold text-white", "font-semibold text-slate-800")
    content = content.replace("bg-[#1e293b] rounded-full", "bg-slate-100 rounded-full")
    
    # Tab 3: Profile stats boxes
    content = content.replace("bg-[#0f172a] border-[#1e293b]", "bg-slate-50 border-slate-200")
    content = content.replace("bg-slate-50 w-10 h-10 rounded-xl", "bg-white w-10 h-10 rounded-xl")
    content = content.replace("font-black text-white truncate", "font-bold text-slate-800 truncate")
    
    # Profile skills tags
    content = content.replace("bg-[#1e293b] text-[#f8fafc] text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#1e293b]", "bg-slate-100 text-slate-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200")
    content = content.replace("bg-[#1e293b] text-slate-300 border border-[#1e293b]", "bg-slate-100 text-slate-600 border border-slate-200")
    content = content.replace("bg-brand-500/10 text-brand-300 border border-brand-500/20", "bg-brand-50 text-brand-700 border border-brand-200")
    
    # Timeline dot & elements
    content = content.replace("bg-slate-50 border-l border-slate-200", "bg-white border-l border-slate-200")
    content = content.replace("bg-slate-50 rounded-full border-2 border-brand-500", "bg-white rounded-full border-2 border-brand-500")
    content = content.replace("font-extrabold text-white text-sm", "font-extrabold text-slate-800 text-sm")
    content = content.replace("text-brand-300 font-bold mt-1", "text-brand-600 font-semibold mt-1")
    
    # Education & Languages
    content = content.replace("bg-slate-50 font-bold", "bg-slate-100 font-bold")
    content = content.replace("font-bold text-white leading-snug", "font-bold text-slate-800 leading-snug")
    content = content.replace("text-slate-400 font-semibold", "text-slate-500 font-semibold")
    content = content.replace("bg-slate-100 text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 font-bold", "bg-slate-100 text-slate-650 px-2 py-0.5 rounded-md border border-slate-200 font-semibold")
    content = content.replace("font-bold text-white", "font-semibold text-slate-800")
    content = content.replace("text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200", "text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200")
    
    # Tab 4: Management inputs, side panel
    content = content.replace("option key={e} value={e} className=\"bg-[#0f172a]\"", "option key={e} value={e} className=\"bg-white text-slate-700\"")
    content = content.replace("option value=\"\" className=\"bg-[#0f172a]\"", "option value=\"\" className=\"bg-white text-slate-700\"")
    content = content.replace("className=\"bg-[#0f172a]\"", "className=\"bg-white text-slate-700\"")
    content = content.replace("text-brand-300", "text-brand-600")
    content = content.replace("bg-slate-50 border border-slate-200 text-slate-300 rounded-2xl p-6", "bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl p-6 shadow-sm")
    content = content.replace("text-slate-500", "text-slate-400")
    
    # Tab 5: Email sender details
    content = content.replace("bg-slate-50 border border-slate-200 text-white flex items-center", "bg-slate-100 border border-slate-200 text-slate-700 flex items-center")
    content = content.replace("font-extrabold text-white text-sm leading-none", "font-extrabold text-slate-800 text-sm leading-none")
    content = content.replace("bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md", "bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md")
    content = content.replace("bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-300", "bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-700")
    content = content.replace("bg-emerald-950/40 text-emerald-400 border-emerald-900/30", "bg-emerald-50 text-emerald-700 border-emerald-200")
    content = content.replace("bg-red-950/40 text-red-400 border-red-900/30", "bg-red-50 text-red-700 border-red-200")
    
    return content

# Read and process DetailDrawer.jsx
with open("d:\\Hidroobras\\Hojas de vida\\frontend\\src\\components\\DetailDrawer.jsx", "r", encoding="utf-8") as f:
    drawer_content = f.read()

new_drawer = refactor_content(drawer_content)

with open("d:\\Hidroobras\\Hojas de vida\\frontend\\src\\components\\DetailDrawer.jsx", "w", encoding="utf-8") as f:
    f.write(new_drawer)

# Read and process DetailModal.jsx
with open("d:\\Hidroobras\\Hojas de vida\\frontend\\src\\components0\\DetailModal.jsx" if False else "d:\\Hidroobras\\Hojas de vida\\frontend\\src\\components\\DetailModal.jsx", "r", encoding="utf-8") as f:
    modal_content = f.read()

new_modal = refactor_content(modal_content)

with open("d:\\Hidroobras\\Hojas de vida\\frontend\\src\\components\\DetailModal.jsx", "w", encoding="utf-8") as f:
    f.write(new_modal)

print("SUCCESS: Both components successfully refactored to light mode!")
