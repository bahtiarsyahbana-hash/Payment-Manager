import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { db, CommissionNote } from '../store/db';
import { DollarSign, TrendingUp, Briefcase } from 'lucide-react';
import { formatIDR } from '../lib/utils';

export default function Dashboard() {
  const [notes, setNotes] = useState<CommissionNote[]>([]);

  useEffect(() => {
    const unsub = db.subscribeNotes(setNotes);
    return () => unsub();
  }, []);

  const approvedNotes = notes.filter(n => n.status === 'Approved' || n.status === 'Commission Received');
  const totalRevenue = approvedNotes.reduce((sum, note) => sum + note.totalNetCommission, 0);
  
  let totalPayouts = 0;
  let companyNetIncome = 0;
  
  approvedNotes.forEach(note => {
    note.details.forEach(detail => {
      totalPayouts += detail.distributions.reduce((sum, dist) => sum + dist.amount, 0);
      companyNetIncome += detail.companyNetIncome;
    });
  });

  // Prepare chart data
  const chartData = approvedNotes.map(note => {
    let notePayouts = 0;
    let noteIncome = 0;
    note.details.forEach(detail => {
      notePayouts += detail.distributions.reduce((sum, dist) => sum + dist.amount, 0);
      noteIncome += detail.companyNetIncome;
    });
    return {
      name: note.noteId,
      Revenue: note.totalNetCommission,
      Payouts: notePayouts,
      Income: noteIncome
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatIDR(totalRevenue)}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-red-100 rounded-lg text-red-600">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Payouts</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatIDR(totalPayouts)}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-lg text-green-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Company Net Income</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatIDR(companyNetIncome)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Income Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="Payouts" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
