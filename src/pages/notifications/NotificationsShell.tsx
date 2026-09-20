import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Bell, AlertTriangle, CheckCircle2, RefreshCw, Filter, CheckCheck } from 'lucide-react';

interface NotificationItem {
  id: string;
  branch_id: string | null;
  target_role: string | null;
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationsShell: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from('notifications') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await (supabase.from('notifications') as any)
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev =>
        prev.map(item => item.id === id ? { ...item, is_read: true } : item)
      );
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await (supabase.from('notifications') as any)
        .update({ is_read: true })
        .eq('is_read', false);

      setNotifications(prev =>
        prev.map(item => ({ ...item, is_read: true }))
      );
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  const filteredNotifications = notifications.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterRead === 'unread' && item.is_read) return false;
    if (filterRead === 'read' && !item.is_read) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="p-6 space-y-6 font-sans text-slate-100" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-white tracking-wide">مركز الإشعارات والتنبيهات</h2>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 bg-rose-500 text-white rounded-full text-xs font-bold animate-pulse">
                {unreadCount} غير مقروء
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">تنبيهات نقص المخزون التلقائية، فوارق الوردية، وإشعارات النظام الحية</p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={fetchNotifications} variant="outline" className="text-xs flex items-center gap-1.5 border-slate-700 hover:bg-slate-800">
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث
          </Button>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5">
              <CheckCheck className="w-4 h-4" />
              تحديد الكل كـ مقروء
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-300">تصفية الإشعارات:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">جميع الأنواع</option>
            <option value="stock_alert">تنبيهات المخزون (Stock Alert)</option>
            <option value="shift_alert">تنبيهات الوردية (Shift Alert)</option>
            <option value="system">نظام (System)</option>
          </select>

          <select
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="unread">غير مقروء فقط</option>
            <option value="read">المقروء فقط</option>
          </select>
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="mr-3 text-slate-300">جاري تحميل الإشعارات...</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card className="p-8 bg-slate-900/90 border border-slate-800">
          <EmptyState
            icon={<Bell className="w-12 h-12 text-slate-500" />}
            title="لا توجد إشعارات مطابقة"
            description="لم يتم العثور على إشعارات حالياً وفقاً للتصفية المختارة."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => {
            const isStock = n.type === 'stock_alert';
            return (
              <Card
                key={n.id}
                className={`p-4 bg-slate-900/90 border transition-all ${
                  !n.is_read ? 'border-amber-500/40 bg-slate-900/95 shadow-md' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${isStock ? 'bg-amber-950 text-amber-400 border border-amber-500/30' : 'bg-blue-950 text-blue-400 border border-blue-500/30'}`}>
                      {isStock ? <AlertTriangle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-white">{n.title_ar}</h4>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">{n.message_ar}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">
                        {new Date(n.created_at).toLocaleString('ar-EG')}
                      </p>
                    </div>
                  </div>

                  {!n.is_read && (
                    <Button
                      onClick={() => markAsRead(n.id)}
                      variant="outline"
                      className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800 py-1 px-3 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      تعليم كـ مقروء
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
