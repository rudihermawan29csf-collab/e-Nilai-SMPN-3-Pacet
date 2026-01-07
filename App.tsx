import React, { useState, useEffect, useRef } from 'react';
import { 
    User, LogOut, Save,
    FileSpreadsheet, GraduationCap,
    List, Settings, Upload, Printer,
    Download, FileDown, AlertCircle, Clock, UserCheck, ChevronDown, BookX, AlertTriangle, Cloud,
    PlusCircle, Edit, Trash2, Layers
} from 'lucide-react';

import { api } from './services/api';
import { DEFAULT_SCHOOL_CONFIG, RAW_STUDENTS, CLASSES } from './constants';
import { 
    Student, 
    AssignmentsMap, 
    SchoolConfig, 
    ClassConfigMap, 
    Role, 
    SyncStatus, 
    MonitoringFilter, 
    InputForm, 
    Assignment,
    ChapterScores
} from './types';

// Declare window interface for jsPDF since it's loaded via CDN
declare global {
    interface Window {
        jspdf: any;
    }
}

// Helper Components
const MacTrafficLights = () => (
    <div className="flex gap-2 group">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-[#E0443E]"></div>
        <div className="w-3 h-3 rounded-full bg-[#FEBC2E] border border-[#D89E24]"></div>
        <div className="w-3 h-3 rounded-full bg-[#28C840] border border-[#1AAB29]"></div>
    </div>
);

const getScoreColor = (value: string | number) => {
    const num = parseFloat(String(value));
    if (isNaN(num) || value === "") return "text-gray-900"; 
    if (num >= 80 && num <= 100) return "text-green-700 font-bold";
    if (num >= 70 && num < 80) return "text-yellow-700 font-bold";
    if (num >= 0 && num < 70) return "text-red-600 font-bold";
    return "text-gray-900";
};

const getChapterHeaderColor = (index: number) => {
    const colors = [
        "bg-blue-100 text-blue-800 border-blue-200", 
        "bg-emerald-100 text-emerald-800 border-emerald-200",
        "bg-violet-100 text-violet-800 border-violet-200", 
        "bg-orange-100 text-orange-800 border-orange-200", 
        "bg-pink-100 text-pink-800 border-pink-200" 
    ];
    return colors[index % colors.length] || "bg-gray-100";
};

const getHeaderColorPDF = (idx: number) => {
    const colors = [
        [219, 234, 254], [209, 250, 229], [237, 233, 254], [255, 237, 213], [252, 231, 243] 
    ];
    return colors[idx % colors.length] || [243, 244, 246];
};

const App: React.FC = () => {
    const [role, setRole] = useState<Role>(null); 
    const [selectedClass, setSelectedClass] = useState<string>("VII A");
    const [studentName, setStudentName] = useState<string>(""); 
    const [loading, setLoading] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<string>('grades'); 
    const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
    const [classConfig, setClassConfig] = useState<ClassConfigMap>({}); 
    const [logoError, setLogoError] = useState<boolean>(false);
    const [studentsData, setStudentsData] = useState<Student[]>([]);
    const [assignments, setAssignments] = useState<AssignmentsMap>({}); 
    const [syncStatus] = useState<SyncStatus>('idle');
    const [viewMode, setViewMode] = useState<string>('all'); 
    const [isDirty, setIsDirty] = useState<boolean>(false);
    const [monitoringFilter, setMonitoringFilter] = useState<MonitoringFilter>({ bab: 'all', type: 'all' });
    const [monitoringView, setMonitoringView] = useState<string>('list'); 
    const [passwordInput, setPasswordInput] = useState<string>("");
    const [loginError, setLoginError] = useState<string>("");
    const [loginTab, setLoginTab] = useState<string>("student");
    const [showInputModal, setShowInputModal] = useState<boolean>(false);
    const [editingKey, setEditingKey] = useState<string | null>(null); 
    const [inputForm, setInputForm] = useState<InputForm>({ date: new Date().toISOString().split('T')[0], bab: '1', type: 'f1', desc: '' });
    const [tempSchoolConfig, setTempSchoolConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
    const [tempChapterCount, setTempChapterCount] = useState<number>(5);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeChapterCount = classConfig[selectedClass]?.chapterCount || 5;

    // --- LOAD DATA ---
    const loadData = async () => {
        setLoading(true);
        const settingsData = await api.get('settings_global');
        if (settingsData) {
            setSchoolConfig({ ...DEFAULT_SCHOOL_CONFIG, ...settingsData.school });
            setClassConfig(settingsData.classes || {});
        }

        const cleanClassName = selectedClass.replace(/ /g, "_");
        const gradesData = await api.get(`grades_${cleanClassName}`);
        
        if (gradesData) {
            setStudentsData(gradesData.students || []);
            setAssignments(gradesData.assignments || {});
        } else {
            const rawNames = RAW_STUDENTS[selectedClass] || [];
            const initialData: Student[] = rawNames.map((name, index) => ({
                id: index + 1, 
                name: name, 
                chapters: Array(5).fill(null).map(() => ({ f1: "", f2: "", f3: "", f4: "", f5: "", sum: "" })), 
                sts: "", 
                sas: ""
            }));
            setStudentsData(initialData);
            setAssignments({});
        }
        setIsDirty(false);
        setLoading(false);
    };

    useEffect(() => {
        if (role) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, selectedClass]);

    useEffect(() => {
        setTempSchoolConfig(schoolConfig);
        setTempChapterCount(classConfig[selectedClass]?.chapterCount || 5);
    }, [schoolConfig, classConfig, selectedClass]);

    const handleLogin = () => {
        if (loginTab === 'admin') {
            if (passwordInput === 'admin123') { setRole('admin'); setLoginError(""); } else { setLoginError("Password salah!"); }
        } else { 
            if (!studentName) { setLoginError("Pilih nama siswa!"); return; }
            setRole('student'); 
            setMonitoringView('student');
        }
    };

    const handleCreateOrUpdateAssignment = async () => {
        if (!inputForm.desc) { alert("Harap isi keterangan tugas!"); return; }
        
        let assignmentKey = "";
        if (inputForm.bab === 'STS') assignmentKey = "sts";
        else if (inputForm.bab === 'SAS') assignmentKey = "sas";
        else { const babIndex = parseInt(inputForm.bab) - 1; assignmentKey = `c${babIndex}_${inputForm.type}`; }
        
        const newAssignment: Assignment = { date: inputForm.date, bab: inputForm.bab, type: inputForm.type, desc: inputForm.desc, createdBy: 'Admin', createdAt: new Date().toISOString() };
        const newAssignments = { ...assignments, [assignmentKey]: newAssignment };
        
        setAssignments(newAssignments);
        setShowInputModal(false);
        setEditingKey(null);

        setLoading(true);
        const cleanClassName = selectedClass.replace(/ /g, "_");
        const success = await api.post(`grades_${cleanClassName}`, { students: studentsData, assignments: newAssignments });
        setLoading(false);
        if(!success) alert("Gagal menyimpan tugas ke Spreadsheet. Cek koneksi internet.");
    };

    const handleDeleteAssignment = async (key: string) => {
        // eslint-disable-next-line no-restricted-globals
        if (!confirm("Hapus input nilai ini?")) return;
        const newAssignments = { ...assignments };
        delete newAssignments[key];
        
        setAssignments(newAssignments);

        setLoading(true);
        const cleanClassName = selectedClass.replace(/ /g, "_");
        const success = await api.post(`grades_${cleanClassName}`, { students: studentsData, assignments: newAssignments });
        setLoading(false);
        if(!success) alert("Gagal menghapus tugas dari Spreadsheet.");
    };

    const updateScore = (studentIndex: number, type: string, value: string, chapterIndex: number | null = null, subField: string | null = null) => {
        if (role !== 'admin') return;
        
        // Security Check
        let lockKey = "";
        if (type === 'sts') lockKey = 'sts';
        else if (type === 'sas') lockKey = 'sas';
        else if (type === 'chapter' && chapterIndex !== null && subField !== null) lockKey = `c${chapterIndex}_${subField}`;
        
        if (!assignments[lockKey]) return; 

        const newStudents = JSON.parse(JSON.stringify(studentsData)); 
        const numValue = value === "" ? "" : parseFloat(value);
        if (type === 'chapter' && chapterIndex !== null && subField !== null) {
            if (!newStudents[studentIndex].chapters[chapterIndex]) newStudents[studentIndex].chapters[chapterIndex] = { f1:"", f2:"", f3:"", f4:"", f5:"", sum:"" };
            newStudents[studentIndex].chapters[chapterIndex][subField] = numValue;
        } else {
            newStudents[studentIndex][type] = numValue;
        }
        setStudentsData(newStudents);
        setIsDirty(true);
    };

    const handleSaveData = async () => {
        setLoading(true);
        const cleanClassName = selectedClass.replace(/ /g, "_");
        const success = await api.post(`grades_${cleanClassName}`, { students: studentsData, assignments: assignments });
        setLoading(false);
        if (success) {
            setIsDirty(false);
            alert("Data Berhasil Disimpan ke Google Spreadsheet!");
        } else {
            alert("Gagal menyimpan data. Pastikan URL Script benar.");
        }
    };

    const saveGlobalSettings = async () => {
        setLoading(true);
        const success = await api.post('settings_global', { 
            school: tempSchoolConfig, 
            classes: { ...classConfig, [selectedClass]: { chapterCount: parseInt(tempChapterCount.toString()) } } 
        });
        setLoading(false);
        if (success) {
            setSchoolConfig(tempSchoolConfig);
            setClassConfig({ ...classConfig, [selectedClass]: { chapterCount: parseInt(tempChapterCount.toString()) } });
            alert("Pengaturan berhasil disimpan."); 
        } else {
            alert("Gagal menyimpan pengaturan.");
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            const lines = text.split('\n');
            const newStudents: Student[] = [];
            lines.forEach((line, idx) => {
                const cleanLine = line.trim();
                if (!cleanLine) return;
                const parts = cleanLine.split(/,|;/); 
                let name = parts[0];
                if (parts.length > 1 && !isNaN(parseInt(parts[0])) && parts[1]) name = parts[1];
                name = name.replace(/^"|"$/g, '').trim();
                if (name && name.toLowerCase() !== 'nama' && name.toLowerCase() !== 'name') {
                    newStudents.push({ id: idx + 1, name: name, chapters: Array(5).fill(null).map(() => ({ f1: "", f2: "", f3: "", f4: "", f5: "", sum: "" })), sts: "", sas: "" });
                }
            });
            // eslint-disable-next-line no-restricted-globals
            if (newStudents.length > 0 && confirm(`Ditemukan ${newStudents.length} siswa. Timpa data?`)) {
                setStudentsData(newStudents);
                setIsDirty(true);
                alert("Data diimport. Silakan klik Simpan untuk menyimpan ke Spreadsheet.");
            }
        };
        reader.readAsText(file);
    };

    const calculateChapterRR = (chapter: ChapterScores, chapterIndex: number) => {
        const fields = ['f1', 'f2', 'f3', 'f4', 'f5', 'sum'];
        let totalScore = 0;
        let divisor = 0;
        fields.forEach(f => {
            const assignmentKey = `c${chapterIndex}_${f}`;
            if (assignments[assignmentKey]) {
                divisor++;
                const val = parseFloat(String(chapter[f]));
                totalScore += isNaN(val) ? 0 : val;
            }
        });
        const rr = divisor > 0 ? (totalScore / divisor).toFixed(0) : "";
        return { rr };
    };

    const calculateFinal = (student: Student) => {
        const activeChapters = classConfig[selectedClass]?.chapterCount || 5;
        let totalAllRR = 0;
        student.chapters.slice(0, activeChapters).forEach((ch, idx) => {
            const { rr } = calculateChapterRR(ch, idx);
            totalAllRR += parseFloat(String(rr)) || 0;
        });
        const sts = parseFloat(String(student.sts)) || 0;
        const sas = parseFloat(String(student.sas)) || 0;
        return ((totalAllRR + sts + sas) / (activeChapters + 2)).toFixed(0);
    };

    const getPendingTasks = (student: Student) => {
        const pending: any[] = [];
        Object.entries(assignments).forEach(([key, value]) => {
            const taskInfo = value as Assignment;
            if (monitoringFilter.bab !== 'all' && taskInfo.bab !== monitoringFilter.bab) return;
            if (monitoringFilter.type !== 'all' && taskInfo.type !== monitoringFilter.type) return;
            let isDone = false;
            if (key === 'sts') isDone = !!student.sts;
            else if (key === 'sas') isDone = !!student.sas;
            else {
                const parts = key.split('_');
                if(parts.length === 2 && parts[0].startsWith('c')) {
                    const chIdx = parseInt(parts[0].substring(1));
                    const field = parts[1];
                    if (student.chapters[chIdx]) isDone = !!student.chapters[chIdx][field];
                }
            }
            if (!isDone) pending.push({ ...taskInfo, key });
        });
        return pending;
    };

    const getRemedialTasks = (student: Student) => {
        const remedial: any[] = [];
        const activeChapters = classConfig[selectedClass]?.chapterCount || 5;
        const MIN_SCORE = 70;
        student.chapters.slice(0, activeChapters).forEach((ch, idx) => {
            ['f1', 'f2', 'f3', 'f4', 'f5', 'sum'].forEach(field => {
                 const val = parseFloat(String(ch[field]));
                 if (!isNaN(val) && val < MIN_SCORE) {
                     remedial.push({ bab: `Bab ${idx + 1}`, type: field.toUpperCase(), score: val });
                 }
            });
        });
        if (student.sts && parseFloat(String(student.sts)) < MIN_SCORE) remedial.push({ bab: 'STS', type: 'STS', score: student.sts });
        if (student.sas && parseFloat(String(student.sas)) < MIN_SCORE) remedial.push({ bab: 'SAS', type: 'SAS', score: student.sas });
        return remedial;
    };

    const getMonitoringBreakdown = () => {
        const breakdown: {[key: string]: any[]} = {};
        Object.entries(assignments).forEach(([key, value]) => {
            const task = value as Assignment;
            if (monitoringFilter.bab !== 'all' && task.bab !== monitoringFilter.bab) return;
            if (monitoringFilter.type !== 'all' && task.type !== monitoringFilter.type) return;
            let missingCount = 0;
            studentsData.forEach(s => {
                let isDone = false;
                if (key === 'sts') isDone = !!s.sts;
                else if (key === 'sas') isDone = !!s.sas;
                else {
                    const parts = key.split('_');
                    const chIdx = parseInt(parts[0].substring(1));
                    const field = parts[1];
                    if (s.chapters[chIdx]) isDone = !!s.chapters[chIdx][field];
                }
                if (!isDone) missingCount++;
            });
            if (missingCount > 0) {
                const group = (task.bab === 'STS' || task.bab === 'SAS') ? task.bab : `Bab ${task.bab}`;
                if (!breakdown[group]) breakdown[group] = [];
                breakdown[group].push({ ...task, count: missingCount, key });
            }
        });
        return breakdown;
    };

    const handleDownloadPDF = async () => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'pt', 'a4'); 
            const activeChapters = classConfig[selectedClass]?.chapterCount || 5;
            const chaptersToShow = viewMode === 'all' ? Array.from({length: activeChapters}, (_, i) => i + 1) : [parseInt(viewMode)];
            const headRow1 = [{content: 'No', rowSpan: 2, styles: {valign: 'middle'}}, {content: 'Nama Siswa', rowSpan: 2, styles: {valign: 'middle'}}];
            const headRow2: any[] = [];
            chaptersToShow.forEach(bab => {
                headRow1.push({ content: `BAB ${bab}`, colSpan: 7, styles: { halign: 'center', fillColor: getHeaderColorPDF(bab-1) } } as any);
                ['F1','F2','F3','F4','F5'].forEach(f => headRow2.push(f));
                headRow2.push({ content: 'SUM', styles: { fillColor: [254, 249, 195] }});
                headRow2.push({ content: 'RR', styles: { fillColor: [243, 244, 246], fontStyle: 'bold' }});
            });
            headRow1.push({content: 'STS', rowSpan: 2, styles: {valign: 'middle', fillColor: [255, 237, 213]}} as any);
            headRow1.push({content: 'SAS', rowSpan: 2, styles: {valign: 'middle', fillColor: [243, 232, 255]}} as any);
            headRow1.push({content: 'NILAI AKHIR', rowSpan: 2, styles: {valign: 'middle', fillColor: [220, 252, 231], fontStyle: 'bold'}} as any);
            
            const visibleStudents = role === 'student' ? studentsData.filter(s => s.name === studentName) : studentsData;

            const body = visibleStudents.map((s, idx) => {
                const row = [idx + 1, s.name];
                chaptersToShow.forEach(bab => {
                    const chIdx = bab - 1;
                    const chapter = s.chapters[chIdx];
                    const { rr } = calculateChapterRR(chapter, chIdx);
                    ['f1','f2','f3','f4','f5'].forEach(f => row.push(chapter[f]));
                    row.push(chapter.sum);
                    row.push(rr);
                });
                row.push(s.sts); row.push(s.sas); row.push(calculateFinal(s));
                return row;
            });
            doc.setFontSize(14); doc.text(`Laporan Nilai Siswa - Kelas ${selectedClass}`, 40, 40);
            doc.setFontSize(10); doc.setTextColor(100); doc.text(`${schoolConfig.year} • ${schoolConfig.semester}`, 40, 55);
            doc.autoTable({
                startY: 70, head: [headRow1, headRow2], body: body, theme: 'grid',
                styles: { fontSize: 8, cellPadding: 3, valign: 'middle', halign: 'center', lineWidth: 0.5, lineColor: [220, 220, 220] },
                headStyles: { textColor: [50, 50, 50], lineWidth: 0.5, lineColor: [200, 200, 200] },
                columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 120, halign: 'left' } },
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index > 1) {
                        const val = parseFloat(data.cell.raw);
                        if (!isNaN(val) && data.cell.raw !== "") {
                            if (val < 70) { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
                            else if (val < 80) { data.cell.styles.textColor = [202, 138, 4]; data.cell.styles.fontStyle = 'bold'; }
                            else if (val >= 80) { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold'; }
                        }
                    }
                }
            });
            const finalY = doc.lastAutoTable.finalY + 30;
            const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            if (finalY + 100 > doc.internal.pageSize.height) doc.addPage();
            const sigY = finalY + 100 > doc.internal.pageSize.height ? 50 : finalY;
            doc.setFontSize(10); doc.setTextColor(0);
            const pageWidth = doc.internal.pageSize.width;
            const leftX = 60; const rightX = pageWidth - 200;
            doc.text(`${schoolConfig.city}, ${today}`, rightX, sigY);
            doc.text("Mengetahui,", leftX, sigY + 15);
            doc.text("Kepala SMPN 3 Pacet", leftX, sigY + 30);
            doc.text("Guru Mata Pelajaran", rightX, sigY + 15);
            doc.text("Pendidikan Agama Islam", rightX, sigY + 30);
            const nameY = sigY + 90;
            doc.text(schoolConfig.principalName, leftX, nameY);
            doc.line(leftX, nameY + 2, leftX + doc.getTextWidth(schoolConfig.principalName), nameY + 2);
            doc.text(`NIP. ${schoolConfig.principalNIP}`, leftX, nameY + 15);
            doc.text(schoolConfig.teacherName, rightX, nameY);
            doc.line(rightX, nameY + 2, rightX + doc.getTextWidth(schoolConfig.teacherName), nameY + 2);
            doc.text(`NIP. ${schoolConfig.teacherNIP}`, rightX, nameY + 15);
            doc.save(`Nilai_${selectedClass}_${schoolConfig.semester}.pdf`);
        } catch (e) { console.error(e); alert("Gagal download PDF."); }
    };

    const exportExcel = () => {
        let csv = "No,Nama Siswa,";
        const activeChapters = classConfig[selectedClass]?.chapterCount || 5;
        for(let i=1; i<=activeChapters; i++) csv += `RR Bab ${i},`;
        csv += "STS,SAS,Nilai Akhir\n";
        
        const visibleStudents = role === 'student' ? studentsData.filter(s => s.name === studentName) : studentsData;

        visibleStudents.forEach(s => {
            csv += `${s.id},"${s.name}",`;
            s.chapters.slice(0, activeChapters).forEach((ch, idx) => {
                const { rr } = calculateChapterRR(ch, idx);
                csv += `${rr || 0},`;
            });
            csv += `${s.sts || 0},${s.sas || 0},${calculateFinal(s)}\n`;
        });
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        csv += "\n\n";
        csv += `Mengetahui,,,,,${schoolConfig.city} ${today}\n`;
        csv += "Kepala SMPN 3 Pacet,,,,,Guru Mata Pelajaran\n";
        csv += "\n\n\n";
        csv += `${schoolConfig.principalName},,,,,${schoolConfig.teacherName}\n`;
        csv += `NIP. ${schoolConfig.principalNIP},,,,,NIP. ${schoolConfig.teacherNIP}\n`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Nilai_${selectedClass}_${schoolConfig.semester}.csv`; a.click();
    };

    const handlePrint = () => {
        window.print();
    };

    const getAssignmentDate = (key: string) => {
       if(assignments[key]) {
          const d = new Date(assignments[key].date);
          return `${d.getDate()}/${d.getMonth()+1}`;
       }
       return null;
    }

    if (loading) return <div className="loading-overlay"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div><p className="text-gray-600 font-medium">Memuat data...</p></div>;

    if (!role) {
        return (
            <div className="min-h-screen flex items-center justify-center font-sans relative overflow-hidden">
                <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=2086&auto=format&fit=crop')" }}></div>
                <div className="absolute inset-0 bg-blue-900/40 z-10"></div>
                <div className="absolute inset-0 backdrop-blur-sm z-10"></div>
                <div className="relative w-[400px] bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-2xl overflow-hidden z-20">
                    <div className="h-8 bg-gray-50/50 border-b border-gray-300/50 flex items-center px-4"><MacTrafficLights /></div>
                    <div className="p-8 text-center">
                        <div className="mb-4 flex justify-center">
                            {!logoError ? (
                                // eslint-disable-next-line jsx-a11y/alt-text
                                <img src="Logo SMPN 3 PACET.jpg" className="w-24 h-auto drop-shadow-md" 
                                    onError={(e) => {
                                        setLogoError(true);
                                    }} 
                                />
                            ) : ( <GraduationCap size={48} className="text-blue-600" /> )}
                        </div>
                        <h1 className="text-xl font-bold text-gray-800">SMPN 3 Pacet</h1>
                        <p className="text-sm text-green-700 font-bold tracking-wide mb-6">e-Nilai Pendidikan Agama Islam</p>
                        <div className="bg-gray-200/50 p-1 rounded-lg flex mb-6 shadow-inner">
                            <button onClick={() => setLoginTab('student')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${loginTab === 'student' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>Siswa</button>
                            <button onClick={() => setLoginTab('admin')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${loginTab === 'admin' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>Admin</button>
                        </div>
                        {loginTab === 'admin' ? (
                            <div className="space-y-4">
                                <input type="password" className="w-full bg-white/70 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Password Admin..." value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                                {loginError && <p className="text-red-500 text-[10px] pl-1">{loginError}</p>}
                                <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm shadow-lg">Masuk Sistem</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <select className="w-full bg-white/70 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setStudentName(""); }}>
                                    {CLASSES.map(c => <option key={c} value={c}>Kelas {c}</option>)}
                                </select>
                                
                                {/* STUDENT NAME DROPDOWN */}
                                <div className="relative">
                                    <select 
                                        className="w-full bg-white/70 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        value={studentName}
                                        onChange={e => setStudentName(e.target.value)}
                                    >
                                        <option value="">Pilih Nama Siswa...</option>
                                        {(RAW_STUDENTS[selectedClass] || []).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>

                                {loginError && <p className="text-red-500 text-[10px] pl-1">{loginError}</p>}

                                <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm shadow-lg">Lihat Nilai</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // FILTER STUDENTS DATA FOR VIEW
    const visibleStudents = role === 'student' ? studentsData.filter(s => s.name === studentName) : studentsData;

    return (
        <div className="h-screen w-full bg-[#f3f4f6] flex items-center justify-center p-2 md:p-6 font-sans text-gray-800 overflow-hidden relative print:p-0 print:bg-white">
            <div className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none print:hidden" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=2086&auto=format&fit=crop')" }}></div>
            <div className="w-full h-full max-w-[1600px] bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-white/60 z-10 print:shadow-none print:border-none print:rounded-none">
                <div className="bg-gray-50 border-b border-gray-200/60 flex flex-col shrink-0 print:hidden">
                    <div className="h-10 flex items-center justify-between px-4">
                        <div className="flex items-center gap-4"><MacTrafficLights /><span className="text-xs font-bold text-gray-700">SMPN 3 Pacet</span></div>
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors ${syncStatus === 'syncing' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                <Cloud size={10} className={syncStatus === 'syncing' ? 'animate-pulse' : ''} />
                                <span className="hidden sm:inline">{syncStatus === 'syncing' ? 'Menyimpan...' : 'GSheets Connected'}</span>
                            </div>
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-medium">{schoolConfig.year} • {schoolConfig.semester}</span>
                            <button onClick={() => { setRole(null); setStudentName(""); }} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-md text-gray-500 transition-colors"><LogOut size={14} /></button>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-white/50 backdrop-blur-sm border-t border-gray-200 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1 bg-gray-200/50 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('grades')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'grades' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>
                                <FileSpreadsheet size={14}/> Nilai Siswa
                            </button>
                            <button onClick={() => setActiveTab('monitoring')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'monitoring' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
                                <AlertCircle size={14}/> Monitoring
                            </button>
                            {role === 'admin' && <button onClick={() => setActiveTab('history')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}><List size={14}/> Riwayat Input</button>}
                            {role === 'admin' && <button onClick={() => setActiveTab('settings')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}><Settings size={14}/> Pengaturan</button>}
                        </div>
                        <div className="flex items-center gap-4">
                            {role === 'admin' ? (
                                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-blue-400 outline-none shadow-sm">
                                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            ) : (
                                <span className="text-xs font-bold text-gray-700 bg-white px-3 py-1 rounded border border-gray-300 shadow-sm">{selectedClass} • {studentName}</span>
                            )}

                            {activeTab === 'grades' && (
                                <div className="flex items-center gap-2">
                                    <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 focus:ring-2 focus:ring-blue-400 outline-none shadow-sm">
                                        <option value="all">Semua Bab</option>
                                        {Array.from({length: activeChapterCount}, (_, i) => i + 1).map(n => <option key={n} value={n}>Hanya Bab {n}</option>)}
                                    </select>
                                    {role === 'admin' && (
                                        <>
                                            <button onClick={() => { setEditingKey(null); setInputForm({date: new Date().toISOString().split('T')[0], bab: '1', type: 'f1', desc: ''}); setShowInputModal(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium shadow-md"><PlusCircle size={14} /> Input Nilai</button>
                                            {isDirty && <button onClick={handleSaveData} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium shadow-md animate-pulse"><Save size={14} /> Simpan</button>}
                                        </>
                                    )}
                                    <div className="flex bg-white rounded border border-gray-300 overflow-hidden">
                                        <button onClick={exportExcel} className="p-1.5 hover:bg-green-50 text-green-700 border-r border-gray-300"><Download size={14} /></button>
                                        <button onClick={handleDownloadPDF} className="p-1.5 hover:bg-blue-50 text-blue-700 border-r border-gray-300"><FileDown size={14} /></button>
                                        <button onClick={handlePrint} className="p-1.5 hover:bg-gray-100 text-gray-700"><Printer size={14} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-gray-50/30 overflow-hidden relative">
                    {activeTab === 'grades' && (
                        <div className="h-full overflow-auto custom-scrollbar p-4 print:p-0 print:overflow-visible flex flex-col">
                            <div className="hidden print:block text-center mb-6">
                                <h1 className="text-xl font-bold">Laporan Nilai Siswa</h1>
                                <p>{schoolConfig.year} • {schoolConfig.semester} • Kelas {selectedClass}</p>
                            </div>
                            <div className="flex-1">
                                <div className="bg-white border border-gray-200 rounded-t-lg overflow-hidden shadow-sm inline-block min-w-full relative print:border-none print:shadow-none">
                                    <table id="grades-table" className="border-collapse text-[10px] md:text-xs min-w-full print:text-[9pt] print:w-full">
                                        <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 z-10 shadow-sm print:static">
                                            <tr>
                                                <th rowSpan={2} className="p-2 border-r border-b border-gray-200 w-10 sticky left-0 bg-gray-50 z-20 print:static">No</th>
                                                <th rowSpan={2} className="p-2 border-r border-b border-gray-200 min-w-[200px] text-left sticky left-10 bg-gray-50 z-20 print:static shadow-sm">Nama Siswa</th>
                                                {Array.from({length: activeChapterCount}, (_, i) => i + 1).map((bab, idx) => {
                                                    if (viewMode !== 'all' && viewMode !== String(bab)) return null;
                                                    return <th key={bab} colSpan={7} className={`p-2 border-r border-b text-center tracking-wider ${getChapterHeaderColor(idx)}`}>BAB {bab}</th>;
                                                })}
                                                <th rowSpan={2} className="p-2 border-r border-b border-gray-200 w-12 bg-orange-100 text-orange-800 border-orange-200">STS</th>
                                                <th rowSpan={2} className="p-2 border-r border-b border-gray-200 w-12 bg-purple-100 text-purple-800 border-purple-200">SAS</th>
                                                <th rowSpan={2} className="p-2 border-b border-gray-200 w-16 bg-green-100 text-green-800 border-green-200">NILAI<br/>AKHIR</th>
                                            </tr>
                                            <tr>
                                                {Array.from({length: activeChapterCount}, (_, i) => i + 1).map((bab, idx) => {
                                                    if (viewMode !== 'all' && viewMode !== String(bab)) return null;
                                                    return (
                                                        <React.Fragment key={bab}>
                                                            {['F1','F2','F3','F4','F5'].map(f => {
                                                               const date = getAssignmentDate(`c${idx}_${f.toLowerCase()}`);
                                                               return (
                                                                   <th key={f} className="p-1 border-r border-b border-gray-200 w-10 min-w-[2.5rem] text-center font-normal text-gray-500 bg-white group/th relative">
                                                                       {f}
                                                                       {date && <div className="absolute top-0 right-0 text-[7px] bg-blue-100 text-blue-600 px-0.5 rounded-bl">{date}</div>}
                                                                   </th>
                                                               );
                                                            })}
                                                            <th className="p-1 border-r border-b border-gray-200 w-12 min-w-[3rem] text-center bg-yellow-50 font-medium text-yellow-800 relative">
                                                                SUM
                                                                {getAssignmentDate(`c${idx}_sum`) && <div className="absolute top-0 right-0 text-[7px] bg-yellow-200 text-yellow-800 px-0.5 rounded-bl">{getAssignmentDate(`c${idx}_sum`)}</div>}
                                                            </th>
                                                            <th className="p-1 border-r border-b border-gray-200 w-12 min-w-[3rem] text-center bg-gray-100 font-bold text-gray-700">RR</th>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {visibleStudents.map((student, idx) => (
                                                <tr key={student.id} className="hover:bg-blue-50/10 transition-colors group print:break-inside-avoid">
                                                    <td className="p-2 border-r border-b border-gray-200 text-center text-gray-400 sticky left-0 bg-white group-hover:bg-gray-50 z-10 print:static">{student.id}</td>
                                                    <td className="p-2 border-r border-b border-gray-200 font-medium text-gray-700 sticky left-10 bg-white group-hover:bg-gray-50 z-10 whitespace-nowrap print:static shadow-sm">{student.name}</td>
                                                    {student.chapters.slice(0, activeChapterCount).map((chapter, cIdx) => {
                                                        const bab = cIdx + 1;
                                                        if (viewMode !== 'all' && viewMode !== String(bab)) return null;
                                                        const { rr } = calculateChapterRR(chapter, cIdx);
                                                        return (
                                                            <React.Fragment key={cIdx}>
                                                                {['f1', 'f2', 'f3', 'f4', 'f5'].map((field) => {
                                                                    const lockKey = `c${cIdx}_${field}`;
                                                                    const isUnlocked = assignments[lockKey];
                                                                    return (
                                                                        <td key={field} className="p-0 border-r border-b border-gray-200 relative">
                                                                            <input 
                                                                                type="number" 
                                                                                disabled={role !== 'admin' || !isUnlocked} 
                                                                                className={`w-full h-full p-1.5 text-center outline-none transition-colors print:bg-transparent ${isUnlocked ? 'bg-white ring-1 ring-blue-100 inset-0 z-10' : 'bg-gray-100 text-gray-400'} ${role === 'admin' && isUnlocked ? 'cursor-text focus:bg-white focus:ring-2 focus:ring-blue-400' : 'cursor-default'} ${getScoreColor(chapter[field])}`} 
                                                                                value={chapter[field]} 
                                                                                onChange={(e) => updateScore(idx, 'chapter', e.target.value, cIdx, field)} 
                                                                            />
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="p-0 border-r border-b border-gray-200 relative">
                                                                    {(() => {
                                                                        const lockKey = `c${cIdx}_sum`;
                                                                        const isUnlocked = assignments[lockKey];
                                                                        return (
                                                                            <input 
                                                                                type="number" 
                                                                                disabled={role !== 'admin' || !isUnlocked} 
                                                                                className={`w-full h-full p-1.5 text-center outline-none font-medium transition-colors print:bg-transparent ${isUnlocked ? 'bg-white ring-1 ring-yellow-100 inset-0 z-10' : 'bg-yellow-50/50 text-gray-400'} ${role === 'admin' && isUnlocked ? 'cursor-text focus:bg-white focus:ring-2 focus:ring-yellow-400' : 'cursor-default'} ${getScoreColor(chapter.sum)}`} 
                                                                                value={chapter.sum || ""} 
                                                                                onChange={(e) => updateScore(idx, 'chapter', e.target.value, cIdx, 'sum')} 
                                                                            />
                                                                        );
                                                                    })()}
                                                                </td>
                                                                <td className="p-1 border-r border-b border-gray-200 text-center bg-gray-50 text-gray-700 font-bold">{rr}</td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    <td className="p-0 border-r border-b border-gray-200 relative">
                                                        {(() => {
                                                            const isUnlocked = assignments['sts'];
                                                            const date = getAssignmentDate('sts');
                                                            return (
                                                                <>
                                                                    {date && <div className="absolute top-0 right-0 text-[7px] bg-orange-200 text-orange-800 px-0.5 rounded-bl z-20 pointer-events-none">{date}</div>}
                                                                    <input type="number" disabled={role !== 'admin' || !isUnlocked} className={`w-full h-full p-1.5 text-center outline-none transition-colors print:bg-transparent ${isUnlocked ? 'bg-white ring-1 ring-orange-100 inset-0 z-10' : 'bg-gray-100 text-gray-400'} ${role === 'admin' && isUnlocked ? 'cursor-text focus:bg-white focus:ring-2 focus:ring-orange-400' : 'cursor-default'} ${getScoreColor(student.sts)}`} value={student.sts} onChange={(e) => updateScore(idx, 'sts', e.target.value)} />
                                                                </>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="p-0 border-r border-b border-gray-200 relative">
                                                        {(() => {
                                                            const isUnlocked = assignments['sas'];
                                                            const date = getAssignmentDate('sas');
                                                            return (
                                                                <>
                                                                    {date && <div className="absolute top-0 right-0 text-[7px] bg-purple-200 text-purple-800 px-0.5 rounded-bl z-20 pointer-events-none">{date}</div>}
                                                                    <input type="number" disabled={role !== 'admin' || !isUnlocked} className={`w-full h-full p-1.5 text-center outline-none transition-colors print:bg-transparent ${isUnlocked ? 'bg-white ring-1 ring-purple-100 inset-0 z-10' : 'bg-gray-100 text-gray-400'} ${role === 'admin' && isUnlocked ? 'cursor-text focus:bg-white focus:ring-2 focus:ring-purple-400' : 'cursor-default'} ${getScoreColor(student.sas)}`} value={student.sas} onChange={(e) => updateScore(idx, 'sas', e.target.value)} />
                                                                </>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="p-2 border-b border-gray-200 text-center font-bold text-gray-800 bg-green-50/20">
                                                        <span className={`px-2 py-0.5 rounded ${getScoreColor(calculateFinal(student))}`}>{calculateFinal(student)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="mt-12 mb-8 px-10 grid grid-cols-2 gap-20 text-sm text-gray-800 print:grid-cols-2">
                                <div className="flex flex-col items-center text-center">
                                    <div className="h-[4.5rem] flex flex-col justify-end"><p>Mengetahui,</p><p className="font-bold">Kepala SMPN 3 Pacet</p></div>
                                    <div className="h-24"></div>
                                    <div className="flex flex-col items-center"><p className="font-bold underline">{schoolConfig.principalName}</p><p>NIP. {schoolConfig.principalNIP}</p></div>
                                </div>
                                <div className="flex flex-col items-center text-center">
                                    <div className="h-[4.5rem] flex flex-col justify-end">
                                        <p className="mb-0.5">{schoolConfig.city}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        <p>Guru Mata Pelajaran</p><p className="font-bold">Pendidikan Agama Islam</p>
                                    </div>
                                    <div className="h-24"></div>
                                    <div className="flex flex-col items-center"><p className="font-bold underline">{schoolConfig.teacherName}</p><p>NIP. {schoolConfig.teacherNIP}</p></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'monitoring' && (
                        <div className="h-full overflow-auto custom-scrollbar p-6">
                            <div className="max-w-6xl mx-auto space-y-6">
                                {/* Controls - Hide for Student Role if they are locked to themselves */}
                                {role === 'admin' && (
                                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Filter Bab</label><select className="px-3 py-1.5 border rounded text-xs" value={monitoringFilter.bab} onChange={(e) => setMonitoringFilter({...monitoringFilter, bab: e.target.value})}><option value="all">Semua Bab</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>Bab {n}</option>)}<option value="STS">STS</option><option value="SAS">SAS</option></select></div>
                                            <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Filter Jenis</label><select className="px-3 py-1.5 border rounded text-xs" value={monitoringFilter.type} onChange={(e) => setMonitoringFilter({...monitoringFilter, type: e.target.value})}><option value="all">Semua Jenis</option>{['f1','f2','f3','f4','f5','sum','sts','sas'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></div>
                                        </div>
                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                            <button onClick={() => setMonitoringView('list')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${monitoringView === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}><List size={14}/> Ringkasan</button>
                                            <button onClick={() => setMonitoringView('student')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${monitoringView === 'student' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}><UserCheck size={14}/> Tanggungan</button>
                                            <button onClick={() => setMonitoringView('remedial')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${monitoringView === 'remedial' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}><AlertTriangle size={14}/> Remidi</button>
                                        </div>
                                    </div>
                                )}

                                {/* Monitoring View */}
                                {monitoringView === 'list' && role === 'admin' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Object.entries(getMonitoringBreakdown()).map(([groupName, tasks]) => (
                                                <div key={groupName} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 font-bold text-gray-700 text-sm flex justify-between items-center"> 
                                                        <span>{groupName}</span>
                                                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{tasks.length} Jenis</span>
                                                    </div>
                                                    <div className="p-4 space-y-3">
                                                        {tasks.map((t, idx) => (
                                                            <div key={idx} className="flex justify-between items-center text-sm">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-gray-800">{t.type?.toUpperCase() || t.bab}</span>
                                                                    <span className="text-[10px] text-gray-400 line-clamp-1 w-32" title={t.desc}>{t.desc}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                                        <div className="bg-red-500 h-full rounded-full" style={{ width: `${(t.count / studentsData.length) * 100}%` }}></div>
                                                                    </div>
                                                                    <span className="text-red-600 font-bold text-xs whitespace-nowrap">{t.count} Siswa</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {Object.keys(getMonitoringBreakdown()).length === 0 && <div className="col-span-full p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">Tidak ada data tugas yang belum tuntas.</div>}
                                        </div>
                                    </div>
                                )}
                                {monitoringView === 'student' && (
                                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                       {visibleStudents.map(student => {
                                           const pending = getPendingTasks(student);
                                           if (pending.length === 0) return null;
                                           return <div key={student.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">{student.id}</div>
                                                        <h4 className="font-bold text-sm text-gray-800 line-clamp-1">{student.name}</h4>
                                                    </div>
                                                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{pending.length} Tugas</span>
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    {pending.map((task, i) => (
                                                        <div key={i} className="flex items-start gap-2 text-xs p-2 bg-gray-50 rounded border border-gray-100">
                                                            <Clock size={12} className="text-gray-400 mt-0.5 shrink-0" />
                                                            <div>
                                                                <p className="font-semibold text-gray-700">{task.bab === 'STS' || task.bab === 'SAS' ? task.bab : `Bab ${task.bab}`} - {task.type?.toUpperCase()}</p>
                                                                <p className="text-gray-500 text-[10px] line-clamp-1">{task.desc}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                           </div>;
                                       })}
                                       {visibleStudents.every(s => getPendingTasks(s).length === 0) && (
                                           <div className="col-span-full p-12 text-center text-gray-400">Semua tugas telah tuntas! 🎉</div>
                                       )}
                                   </div>
                                )}
                                {monitoringView === 'remedial' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {visibleStudents.map(student => {
                                            const remedialTasks = getRemedialTasks(student);
                                            if (remedialTasks.length === 0) return null;
                                            return <div key={student.id} className="bg-white border border-red-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">{student.id}</div>
                                                        <h4 className="font-bold text-sm text-gray-800 line-clamp-1">{student.name}</h4>
                                                    </div>
                                                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{remedialTasks.length} Remidi</span>
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    {remedialTasks.map((task, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs p-2 bg-red-50 rounded border border-red-100">
                                                            <div className="flex items-center gap-2">
                                                                <BookX size={12} className="text-red-400" />
                                                                <span className="font-medium text-gray-700">{task.bab} - {task.type}</span>
                                                            </div>
                                                            <span className="font-bold text-red-600">{task.score}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>;
                                        })}
                                         {visibleStudents.every(s => getRemedialTasks(s).length === 0) && (
                                           <div className="col-span-full p-12 text-center text-gray-400">Tidak ada siswa yang perlu remidi! 🌟</div>
                                       )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="h-full overflow-auto custom-scrollbar p-6">
                            <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg"><h3 className="font-bold text-gray-700 flex items-center gap-2"><List size={18}/> Riwayat Input Nilai</h3></div>
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0"><tr><th className="p-3">Tanggal</th><th className="p-3">Bab</th><th className="p-3">Jenis Nilai</th><th className="p-3">Keterangan Tugas</th>{role === 'admin' && <th className="p-3 text-center">Aksi</th>}</tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {Object.entries(assignments).map(([key, data]) => (
                                            <tr key={key} className="hover:bg-gray-50">
                                                <td className="p-3">{data.date}</td>
                                                <td className="p-3 font-medium">{data.bab === 'STS' || data.bab === 'SAS' ? data.bab : `Bab ${data.bab}`}</td>
                                                <td className="p-3 uppercase"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{data.type || data.bab}</span></td>
                                                <td className="p-3 text-gray-600">{data.desc}</td>
                                                {role === 'admin' && (
                                                    <td className="p-3 flex justify-center gap-3">
                                                        <button 
                                                            onClick={() => { setEditingKey(key); setInputForm({date: data.date, bab: data.bab, type: data.type, desc: data.desc}); setShowInputModal(true); }} 
                                                            className="text-blue-500 hover:text-blue-700"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteAssignment(key)} 
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {Object.keys(assignments).length === 0 && <div className="p-8 text-center text-gray-400">Belum ada riwayat tugas.</div>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && role === 'admin' && (
                        <div className="h-full overflow-auto custom-scrollbar p-6">
                            <div className="max-w-3xl mx-auto space-y-6">
                                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Settings size={18}/> Identitas Sekolah & Guru</h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nama Kepala Sekolah</label><input type="text" value={tempSchoolConfig.principalName} onChange={e => setTempSchoolConfig({...tempSchoolConfig, principalName: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                        <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">NIP Kepala Sekolah</label><input type="text" value={tempSchoolConfig.principalNIP} onChange={e => setTempSchoolConfig({...tempSchoolConfig, principalNIP: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                        <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nama Guru Mapel</label><input type="text" value={tempSchoolConfig.teacherName} onChange={e => setTempSchoolConfig({...tempSchoolConfig, teacherName: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                        <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">NIP Guru</label><input type="text" value={tempSchoolConfig.teacherNIP} onChange={e => setTempSchoolConfig({...tempSchoolConfig, teacherNIP: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                        <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Kota (Tanda Tangan)</label><input type="text" value={tempSchoolConfig.city} onChange={e => setTempSchoolConfig({...tempSchoolConfig, city: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Settings size={18}/> Pengaturan Umum</h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tahun Pelajaran</label><input type="text" value={tempSchoolConfig.year} onChange={e => setTempSchoolConfig({...tempSchoolConfig, year: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                        <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Semester</label><select value={tempSchoolConfig.semester} onChange={e => setTempSchoolConfig({...tempSchoolConfig, semester: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option></select></div>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Layers size={18}/> Pengaturan Kelas: {selectedClass}</h3>
                                    <div className="mb-4">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Jumlah Bab Materi</label>
                                        <div className="flex gap-2">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setTempChapterCount(n)} className={`w-10 h-10 rounded border font-bold transition-all ${tempChapterCount === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>{n}</button>)}</div>
                                        <p className="text-[10px] text-gray-400 mt-2">Menentukan jumlah kolom Bab yang aktif untuk perhitungan nilai.</p>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><User size={18}/> Data Siswa</h3>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
                                        <Upload className="mx-auto text-gray-400 mb-2" size={32}/>
                                        <p className="text-sm font-medium text-gray-600 mb-1">Upload Data Siswa (Excel/CSV)</p>
                                        <p className="text-xs text-gray-400 mb-4">Format: Kolom pertama "Nama Siswa" atau "No,Nama"</p>
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" className="hidden" />
                                        <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-100 transition-colors">Pilih File</button>
                                    </div>
                                </div>
                                <button onClick={saveGlobalSettings} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95">Simpan Semua Pengaturan</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showInputModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">{editingKey ? <Edit size={16}/> : <PlusCircle size={16}/>} {editingKey ? 'Edit Tugas' : 'Input Nilai Baru'}</h3>
                            <button onClick={() => {setShowInputModal(false); setEditingKey(null);}} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Bab</label><select className="w-full border p-2 rounded text-sm" value={inputForm.bab} onChange={e => setInputForm({...inputForm, bab: e.target.value, type: ['STS','SAS'].includes(e.target.value) ? '' : 'f1'})} disabled={!!editingKey}>{[1,2,3,4,5].map(n => <option key={n} value={n}>Bab {n}</option>)}<option value="STS">STS</option><option value="SAS">SAS</option></select></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Jenis</label><select className="w-full border p-2 rounded text-sm" value={inputForm.type} onChange={e => setInputForm({...inputForm, type: e.target.value})} disabled={['STS','SAS'].includes(inputForm.bab) || !!editingKey}>{['STS','SAS'].includes(inputForm.bab) ? <option value={inputForm.bab.toLowerCase()}>{inputForm.bab}</option> : ['f1','f2','f3','f4','f5'].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>).concat(<option value="sum">SUMATIF</option>)}</select></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Keterangan</label><textarea className="w-full border p-2 rounded text-sm h-20" value={inputForm.desc} onChange={e => setInputForm({...inputForm, desc: e.target.value})} placeholder="Deskripsi tugas..."></textarea></div>
                            <button onClick={handleCreateOrUpdateAssignment} className="w-full bg-blue-600 text-white py-2 rounded font-bold">{editingKey ? 'Simpan' : 'Buka Akses'}</button>
                        </div>
                    </div>
                </div>
            )}
            {role === 'admin' && isDirty && (
                <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
                    <button onClick={handleSaveData} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-bold shadow-xl transition-transform active:scale-95"><Save size={20}/> Simpan Perubahan</button>
                </div>
            )}
        </div>
    );
}

export default App;